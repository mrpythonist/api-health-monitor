import { Router, type Request, type Response } from 'express';
import { prisma } from '../db';
import { cacheGet, cacheSet } from '../cache';
import { uptimePercent } from '../lib/uptime';

const router = Router();

async function uptimeFor(monitorId: string, hours: number): Promise<number | null> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const grouped = await prisma.checkResult.groupBy({
    by: ['status'],
    where: { monitorId, checkedAt: { gte: since } },
    _count: { status: true },
  });
  const statuses = grouped.flatMap((g) => Array<string>(g._count.status).fill(g.status)) as Array<
    'up' | 'down'
  >;
  return uptimePercent(statuses);
}

/**
 * Public status pages — no API key required. This is what you would share
 * with customers or embed, Better Stack / UptimeRobot style.
 */

// GET /status — every enabled monitor's current state + 24h uptime.
router.get('/', async (_req: Request, res: Response) => {
  const key = 'status:all';
  const cached = await cacheGet(key);
  if (cached) {
    res.setHeader('x-cache', 'HIT').json(JSON.parse(cached));
    return;
  }
  const monitors = await prisma.monitor.findMany({
    where: { enabled: true },
    select: { id: true, name: true, slug: true, url: true, lastStatus: true, lastCheckedAt: true },
    orderBy: { name: 'asc' },
  });
  const rows = await Promise.all(
    monitors.map(async (m) => ({ ...m, uptime24h: await uptimeFor(m.id, 24) })),
  );
  const payload = {
    generatedAt: new Date().toISOString(),
    overall: rows.every((r) => r.lastStatus !== 'down') ? 'operational' : 'degraded',
    monitors: rows,
  };
  await cacheSet(key, JSON.stringify(payload));
  res.setHeader('x-cache', 'MISS').json(payload);
});

// GET /status/:slug — one monitor's public status page data.
router.get('/:slug', async (req: Request, res: Response) => {
  const key = `status:${req.params.slug}`;
  const cached = await cacheGet(key);
  if (cached) {
    res.setHeader('x-cache', 'HIT').json(JSON.parse(cached));
    return;
  }
  const monitor = await prisma.monitor.findUnique({ where: { slug: req.params.slug } });
  if (!monitor || !monitor.enabled) {
    res.status(404).json({ error: 'status page not found' });
    return;
  }
  const [up24, up7d, up30d] = await Promise.all([
    uptimeFor(monitor.id, 24),
    uptimeFor(monitor.id, 24 * 7),
    uptimeFor(monitor.id, 24 * 30),
  ]);
  const openIncident = await prisma.incident.findFirst({
    where: { monitorId: monitor.id, status: 'open' },
    orderBy: { startedAt: 'desc' },
  });
  const recentIncidents = await prisma.incident.findMany({
    where: { monitorId: monitor.id, status: 'resolved' },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });
  const recentChecks = await prisma.checkResult.findMany({
    where: { monitorId: monitor.id },
    orderBy: { checkedAt: 'desc' },
    take: 20,
    select: { status: true, statusCode: true, responseTimeMs: true, checkedAt: true },
  });
  const payload = {
    generatedAt: new Date().toISOString(),
    monitor: {
      name: monitor.name,
      slug: monitor.slug,
      url: monitor.url,
      lastStatus: monitor.lastStatus,
      lastCheckedAt: monitor.lastCheckedAt,
    },
    uptime: { '24h': up24, '7d': up7d, '30d': up30d },
    openIncident,
    recentIncidents,
    recentChecks,
  };
  await cacheSet(key, JSON.stringify(payload));
  res.setHeader('x-cache', 'MISS').json(payload);
});

export default router;
