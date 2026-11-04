import { Router, type Request, type Response } from 'express';
import { prisma } from '../db';
import { cacheDel } from '../cache';
import { makeSlug } from '../lib/slug';
import { uptimePercent, average } from '../lib/uptime';
import { ensureSchedule, removeSchedule, triggerCheckNow } from '../scheduler';

const router = Router();

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validationError(body: unknown): string | null {
  const b = body as Record<string, unknown>;
  if (typeof b.name !== 'string' || b.name.trim().length === 0) return 'name is required';
  if (typeof b.url !== 'string' || !isValidHttpUrl(b.url)) return 'url must be a valid http(s) URL';
  if (b.method !== undefined && !ALLOWED_METHODS.includes(String(b.method).toUpperCase()))
    return `method must be one of ${ALLOWED_METHODS.join(', ')}`;
  if (b.expectedStatus !== undefined && (!Number.isInteger(b.expectedStatus) || (b.expectedStatus as number) < 100 || (b.expectedStatus as number) > 599))
    return 'expectedStatus must be an integer 100–599';
  if (b.timeoutMs !== undefined && (!Number.isInteger(b.timeoutMs) || (b.timeoutMs as number) < 1000 || (b.timeoutMs as number) > 60000))
    return 'timeoutMs must be an integer 1000–60000';
  if (b.intervalSeconds !== undefined && (!Number.isInteger(b.intervalSeconds) || (b.intervalSeconds as number) < 30 || (b.intervalSeconds as number) > 86400))
    return 'intervalSeconds must be an integer 30–86400';
  if (b.headers !== undefined && (typeof b.headers !== 'object' || b.headers === null || Array.isArray(b.headers)))
    return 'headers must be a JSON object';
  if (b.incidentWebhookUrl !== undefined && b.incidentWebhookUrl !== null && (typeof b.incidentWebhookUrl !== 'string' || !isValidHttpUrl(b.incidentWebhookUrl)))
    return 'incidentWebhookUrl must be a valid http(s) URL or null';
  return null;
}

async function uptime24h(monitorId: string): Promise<{ uptime: number | null; avgMs: number | null }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const grouped = await prisma.checkResult.groupBy({
    by: ['status'],
    where: { monitorId, checkedAt: { gte: since } },
    _count: { status: true },
  });
  const statuses = grouped.flatMap((g) => Array<string>(g._count.status).fill(g.status)) as Array<'up' | 'down'>;
  const agg = await prisma.checkResult.aggregate({
    where: { monitorId, status: 'up', checkedAt: { gte: since } },
    _avg: { responseTimeMs: true },
  });
  return {
    uptime: uptimePercent(statuses),
    avgMs: agg._avg.responseTimeMs == null ? null : Math.round(agg._avg.responseTimeMs * 10) / 10,
  };
}

// GET /api/monitors — list with current status + 24h uptime summary.
router.get('/', async (_req: Request, res: Response) => {
  const monitors = await prisma.monitor.findMany({ orderBy: { createdAt: 'asc' } });
  const openIncidents = await prisma.incident.findMany({
    where: { status: 'open' },
    select: { monitorId: true, startedAt: true, cause: true },
  });
  const openByMonitor = new Map(openIncidents.map((i) => [i.monitorId, i]));
  const rows = await Promise.all(
    monitors.map(async (m) => {
      const summary = await uptime24h(m.id);
      return {
        ...m,
        uptime24h: summary.uptime,
        avgResponseMs24h: summary.avgMs,
        openIncident: openByMonitor.get(m.id) ?? null,
      };
    }),
  );
  res.json(rows);
});

// POST /api/monitors — register a new endpoint to watch.
router.post('/', async (req: Request, res: Response) => {
  const err = validationError(req.body);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const monitor = await prisma.monitor.create({
    data: {
      name: (b.name as string).trim(),
      slug: makeSlug(b.name as string),
      url: b.url as string,
      method: ((b.method as string) ?? 'GET').toUpperCase(),
      expectedStatus: (b.expectedStatus as number) ?? 200,
      timeoutMs: (b.timeoutMs as number) ?? 10000,
      intervalSeconds: (b.intervalSeconds as number) ?? 60,
      headers: (b.headers as object) ?? undefined,
      incidentWebhookUrl: (b.incidentWebhookUrl as string) ?? null,
      enabled: b.enabled !== false,
    },
  });
  await ensureSchedule(monitor);
  await cacheDel(`status:${monitor.slug}`);
  res.status(201).json(monitor);
});

// GET /api/monitors/:id — detail with uptime windows, latency stats, incidents.
router.get('/:id', async (req: Request, res: Response) => {
  const monitor = await prisma.monitor.findUnique({ where: { id: req.params.id } });
  if (!monitor) {
    res.status(404).json({ error: 'monitor not found' });
    return;
  }
  const windows = [24, 24 * 7, 24 * 30];
  const uptimes: Record<string, number | null> = {};
  for (const hours of windows) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const grouped = await prisma.checkResult.groupBy({
      by: ['status'],
      where: { monitorId: monitor.id, checkedAt: { gte: since } },
      _count: { status: true },
    });
    const statuses = grouped.flatMap((g) => Array<string>(g._count.status).fill(g.status)) as Array<'up' | 'down'>;
    uptimes[`${hours}h`] = uptimePercent(statuses);
  }
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const latencies = await prisma.checkResult.findMany({
    where: { monitorId: monitor.id, status: 'up', checkedAt: { gte: dayAgo } },
    select: { responseTimeMs: true },
    orderBy: { responseTimeMs: 'asc' },
  });
  const ms = latencies.map((l) => l.responseTimeMs ?? 0);
  const recentChecks = await prisma.checkResult.findMany({
    where: { monitorId: monitor.id },
    orderBy: { checkedAt: 'desc' },
    take: 50,
  });
  const incidents = await prisma.incident.findMany({
    where: { monitorId: monitor.id },
    orderBy: { startedAt: 'desc' },
    take: 20,
  });
  res.json({
    monitor,
    uptime: { '24h': uptimes['24h'], '7d': uptimes['168h'], '30d': uptimes['720h'] },
    latency24h: {
      avgMs: average(ms),
      minMs: ms.length ? ms[0] : null,
      maxMs: ms.length ? ms[ms.length - 1] : null,
      samples: ms.length,
    },
    recentChecks,
    incidents,
  });
});

// PATCH /api/monitors/:id — update config; reschedules when interval/enabled change.
router.patch('/:id', async (req: Request, res: Response) => {
  const existing = await prisma.monitor.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'monitor not found' });
    return;
  }
  const b = req.body as Record<string, unknown>;
  const merged = { ...existing, ...b };
  const err = validationError(merged);
  if (err) {
    res.status(400).json({ error: err });
    return;
  }
  const monitor = await prisma.monitor.update({
    where: { id: req.params.id },
    data: {
      name: typeof b.name === 'string' ? b.name.trim() : undefined,
      url: typeof b.url === 'string' ? b.url : undefined,
      method: typeof b.method === 'string' ? b.method.toUpperCase() : undefined,
      expectedStatus: typeof b.expectedStatus === 'number' ? b.expectedStatus : undefined,
      timeoutMs: typeof b.timeoutMs === 'number' ? b.timeoutMs : undefined,
      intervalSeconds: typeof b.intervalSeconds === 'number' ? b.intervalSeconds : undefined,
      headers: b.headers !== undefined ? (b.headers as object) : undefined,
      incidentWebhookUrl:
        b.incidentWebhookUrl !== undefined ? ((b.incidentWebhookUrl as string) ?? null) : undefined,
      enabled: typeof b.enabled === 'boolean' ? b.enabled : undefined,
    },
  });
  await ensureSchedule(monitor);
  await cacheDel(`status:${monitor.slug}`);
  res.json(monitor);
});

// DELETE /api/monitors/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const existing = await prisma.monitor.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'monitor not found' });
    return;
  }
  await removeSchedule(existing.id);
  await cacheDel(`status:${existing.slug}`);
  await prisma.monitor.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// POST /api/monitors/:id/check — trigger an immediate one-off check.
router.post('/:id/check', async (req: Request, res: Response) => {
  const monitor = await prisma.monitor.findUnique({ where: { id: req.params.id } });
  if (!monitor) {
    res.status(404).json({ error: 'monitor not found' });
    return;
  }
  const queued = await triggerCheckNow(monitor.id);
  if (!queued) {
    res.status(503).json({ error: 'check queue unavailable — is Redis running?' });
    return;
  }
  res.status(202).json({ queued: true });
});

export default router;
