import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { performCheck } from './check';
import { decideIncident } from './incidents';
import { sendIncidentWebhook, type WebhookPayload } from './webhook';

const QUEUE_NAME = 'health-checks';
const CHECK_RETENTION_DAYS = 90;

const prisma = new PrismaClient();
const threshold = Number(process.env.INCIDENT_THRESHOLD ?? 2);

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.error('[worker] REDIS_URL is not set — the check queue needs Redis. Exiting.');
  process.exit(1);
}

async function handleCheck(monitorId: string): Promise<void> {
  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
  if (!monitor) {
    console.warn(`[worker] monitor ${monitorId} no longer exists — skipping`);
    return;
  }
  if (!monitor.enabled) {
    console.log(`[worker] monitor ${monitor.name} is disabled — skipping`);
    return;
  }

  const outcome = await performCheck({
    url: monitor.url,
    method: monitor.method,
    headers: (monitor.headers as Record<string, string> | null) ?? undefined,
    expectedStatus: monitor.expectedStatus,
    timeoutMs: monitor.timeoutMs,
  });

  const check = await prisma.checkResult.create({
    data: {
      monitorId: monitor.id,
      status: outcome.status,
      statusCode: outcome.statusCode,
      responseTimeMs: outcome.responseTimeMs,
      error: outcome.error,
    },
  });

  const openIncident = await prisma.incident.findFirst({
    where: { monitorId: monitor.id, status: 'open' },
    orderBy: { startedAt: 'desc' },
  });

  const action = decideIncident({
    checkStatus: outcome.status,
    consecutiveFailsBefore: monitor.consecutiveFails,
    openIncident: openIncident ? { id: openIncident.id } : null,
    threshold,
  });

  await prisma.monitor.update({
    where: { id: monitor.id },
    data: {
      consecutiveFails: action.consecutiveFails,
      lastStatus: outcome.status,
      lastCheckedAt: check.checkedAt,
    },
  });

  const basePayload = {
    monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
    checkedAt: check.checkedAt.toISOString(),
  };

  switch (action.type) {
    case 'open': {
      const incident = await prisma.incident.create({
        data: {
          monitorId: monitor.id,
          cause: outcome.error ?? `check failed`,
          failedChecks: action.consecutiveFails,
        },
      });
      console.log(
        `[worker] INCIDENT OPENED: ${monitor.name} — ${incident.cause} (${action.consecutiveFails} consecutive failures)`,
      );
      if (monitor.incidentWebhookUrl) {
        const payload: WebhookPayload = {
          ...basePayload,
          event: 'incident.opened',
          incident: {
            id: incident.id,
            cause: incident.cause,
            failedChecks: incident.failedChecks,
            startedAt: incident.startedAt.toISOString(),
            resolvedAt: null,
          },
        };
        await sendIncidentWebhook(monitor.incidentWebhookUrl, payload);
      }
      break;
    }
    case 'count': {
      await prisma.incident.update({
        where: { id: action.incidentId },
        data: { failedChecks: { increment: 1 } },
      });
      break;
    }
    case 'resolve': {
      const incident = await prisma.incident.update({
        where: { id: action.incidentId },
        data: { status: 'resolved', resolvedAt: new Date(), resolvedBy: 'worker' },
      });
      const durationMin = Math.round(
        (incident.resolvedAt!.getTime() - incident.startedAt.getTime()) / 60000,
      );
      console.log(
        `[worker] INCIDENT RESOLVED: ${monitor.name} — down for ~${durationMin} min, ${incident.failedChecks} failed checks`,
      );
      if (monitor.incidentWebhookUrl) {
        const payload: WebhookPayload = {
          ...basePayload,
          event: 'incident.resolved',
          incident: {
            id: incident.id,
            cause: incident.cause,
            failedChecks: incident.failedChecks,
            startedAt: incident.startedAt.toISOString(),
            resolvedAt: incident.resolvedAt!.toISOString(),
          },
        };
        await sendIncidentWebhook(monitor.incidentWebhookUrl, payload);
      }
      break;
    }
    case 'none':
      break;
  }

  console.log(
    `[worker] ${monitor.name}: ${outcome.status.toUpperCase()}` +
      (outcome.statusCode ? ` ${outcome.statusCode}` : '') +
      (outcome.responseTimeMs != null ? ` ${outcome.responseTimeMs}ms` : '') +
      (outcome.error ? ` — ${outcome.error}` : ''),
  );
}

async function handlePrune(): Promise<void> {
  const cutoff = new Date(Date.now() - CHECK_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await prisma.checkResult.deleteMany({ where: { checkedAt: { lt: cutoff } } });
  console.log(`[worker] pruned ${deleted.count} check results older than ${CHECK_RETENTION_DAYS} days`);
}

async function main(): Promise<void> {
  const connection = new Redis(redisUrl as string, { maxRetriesPerRequest: null });
  connection.on('error', (err: Error) => console.error('[worker] redis error:', err.message));

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'prune') {
        await handlePrune();
        return;
      }
      const monitorId = (job.data as { monitorId?: string }).monitorId;
      if (!monitorId) throw new Error('job missing monitorId');
      await handleCheck(monitorId);
    },
    { connection, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[worker] job ${job?.id} (${job?.name}) failed: ${err.message}`);
  });

  console.log(`[worker] listening on queue "${QUEUE_NAME}" (incident threshold: ${threshold})`);

  const shutdown = async (): Promise<void> => {
    console.log('[worker] shutting down…');
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[worker] fatal error:', err);
  process.exit(1);
});
