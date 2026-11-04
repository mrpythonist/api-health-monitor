import cors from 'cors';
import express from 'express';
import { requireApiKey } from './auth';
import { initCache } from './cache';
import { queueHealth, syncSchedules } from './scheduler';
import monitorsRouter from './routes/monitors';
import incidentsRouter from './routes/incidents';
import statusRouter from './routes/status';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

app.get('/health', async (_req, res) => {
  const queue = await queueHealth();
  res.json({ ok: true, queue: queue.reachable, time: new Date().toISOString() });
});

// Management API (API key) and public status pages (no auth).
app.use('/api/monitors', requireApiKey, monitorsRouter);
app.use('/api/incidents', requireApiKey, incidentsRouter);
app.use('/status', statusRouter);

app.use((_req, res) => res.status(404).json({ error: 'not found' }));

const PORT = Number(process.env.PORT ?? 3001);

async function main(): Promise<void> {
  await initCache();
  await syncSchedules();
  app.listen(PORT, () => {
    console.log(`[api] listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error('[api] fatal startup error:', err);
  process.exit(1);
});
