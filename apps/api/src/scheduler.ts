import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from './db';

export const QUEUE_NAME = 'health-checks';

let queue: Queue | null = null;
let warned = false;

function warnOnce(message: string): void {
  if (!warned) {
    warned = true;
    console.warn(`[scheduler] ${message}`);
  }
}

/**
 * Lazily create the BullMQ queue. BullMQ needs `maxRetriesPerRequest: null`.
 * Returns null when Redis is unavailable — callers degrade gracefully
 * (the API keeps serving reads/writes; checks just aren't scheduled).
 */
function getQueue(): Queue | null {
  if (queue) return queue;
  const url = process.env.REDIS_URL;
  if (!url) {
    warnOnce('REDIS_URL not set — health checks will not be scheduled');
    return null;
  }
  try {
    const connection = new Redis(url, { maxRetriesPerRequest: null });
    connection.on('error', (err: Error) => warnOnce(`redis error: ${err.message}`));
    queue = new Queue(QUEUE_NAME, { connection });
    return queue;
  } catch (err) {
    warnOnce(`could not create queue: ${(err as Error).message}`);
    return null;
  }
}

function repeatJobId(monitorId: string): string {
  return `check:${monitorId}`;
}

/** (Re)schedule the periodic check for one monitor. No-op when disabled. */
export async function ensureSchedule(monitor: {
  id: string;
  intervalSeconds: number;
  enabled: boolean;
}): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;
  try {
    if (!monitor.enabled) {
      await removeSchedule(monitor.id);
      return true;
    }
    await q.add(
      'check',
      { monitorId: monitor.id },
      {
        jobId: repeatJobId(monitor.id),
        repeat: { every: monitor.intervalSeconds * 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
    return true;
  } catch (err) {
    warnOnce(`scheduling failed: ${(err as Error).message}`);
    return false;
  }
}

/** Remove the periodic check for one monitor (disable/delete). */
export async function removeSchedule(monitorId: string): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;
  try {
    const repeatables = await q.getRepeatableJobs();
    const match = repeatables.find((j) => j.id === repeatJobId(monitorId));
    if (match?.key) await q.removeRepeatableByKey(match.key);
    return true;
  } catch (err) {
    warnOnce(`unscheduling failed: ${(err as Error).message}`);
    return false;
  }
}

/** Enqueue a one-off check right now (the "Check now" button). */
export async function triggerCheckNow(monitorId: string): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;
  try {
    await q.add(
      'check-now',
      { monitorId },
      { jobId: `now:${monitorId}:${Date.now()}`, removeOnComplete: 20, removeOnFail: 50 },
    );
    return true;
  } catch (err) {
    warnOnce(`manual trigger failed: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Reconcile BullMQ repeatable jobs with the monitors table on startup:
 * schedule every enabled monitor, drop jobs whose monitor is gone/disabled,
 * and keep the daily check-result pruning job.
 */
export async function syncSchedules(): Promise<void> {
  const q = getQueue();
  if (!q) return;
  try {
    const monitors = await prisma.monitor.findMany({
      select: { id: true, intervalSeconds: true, enabled: true },
    });
    const wanted = new Map(monitors.map((m) => [repeatJobId(m.id), m]));

    const repeatables = await q.getRepeatableJobs();
    for (const job of repeatables) {
      if (job.name === 'prune') continue;
      if (!wanted.has(job.id ?? '') || !wanted.get(job.id ?? '')?.enabled) {
        if (job.key) await q.removeRepeatableByKey(job.key);
      }
    }
    for (const m of monitors) {
      if (m.enabled) await ensureSchedule(m);
    }
    // Daily pruning of check results older than 90 days (handled by the worker).
    await q.add(
      'prune',
      {},
      { jobId: 'prune:daily', repeat: { every: 24 * 60 * 60 * 1000 }, removeOnComplete: 5 },
    );
    console.log(`[scheduler] synced ${monitors.filter((m) => m.enabled).length} monitor schedules`);
  } catch (err) {
    warnOnce(`sync failed — is Redis running? ${(err as Error).message}`);
  }
}

export async function queueHealth(): Promise<{ reachable: boolean }> {
  const q = getQueue();
  if (!q) return { reachable: false };
  try {
    await q.waitUntilReady();
    return { reachable: true };
  } catch {
    return { reachable: false };
  }
}
