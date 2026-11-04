import { Router, type Request, type Response } from 'express';
import { prisma } from '../db';

const router = Router();

// GET /api/incidents?status=open|resolved|all — incident history.
router.get('/', async (req: Request, res: Response) => {
  const status = String(req.query.status ?? 'open');
  const where = status === 'all' ? {} : status === 'resolved' ? { status: 'resolved' } : { status: 'open' };
  const incidents = await prisma.incident.findMany({
    where,
    include: { monitor: { select: { id: true, name: true, url: true, slug: true } } },
    orderBy: { startedAt: 'desc' },
    take: 100,
  });
  res.json(incidents);
});

// PATCH /api/incidents/:id/resolve — manually close an open incident.
router.patch('/:id/resolve', async (req: Request, res: Response) => {
  const incident = await prisma.incident.findUnique({ where: { id: req.params.id } });
  if (!incident) {
    res.status(404).json({ error: 'incident not found' });
    return;
  }
  if (incident.status === 'resolved') {
    res.json(incident);
    return;
  }
  const resolved = await prisma.incident.update({
    where: { id: incident.id },
    data: { status: 'resolved', resolvedAt: new Date(), resolvedBy: 'manual' },
  });
  res.json(resolved);
});

export default router;
