import express from 'express';

/**
 * Demo target for the health monitor: five endpoints with different
 * behaviors so you can watch checks, incidents and recovery happen live.
 *
 *   GET /ok    -> 200 immediately (healthy)
 *   GET /slow  -> 200 after ~2.5s (healthy but slow — watch response times)
 *   GET /flaky -> alternates 200 / 500 (opens and resolves incidents)
 *   GET /dead  -> 500 always (incident stays open)
 *   GET /hang  -> never responds (triggers the monitor's timeout)
 */

const app = express();
let flakyHits = 0;

app.get('/ok', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/slow', (_req, res) => {
  setTimeout(() => res.json({ status: 'ok', note: 'slow on purpose' }), 2500);
});

app.get('/flaky', (_req, res) => {
  flakyHits += 1;
  if (flakyHits % 2 === 0) {
    res.status(500).json({ status: 'error', note: 'flaky on purpose' });
  } else {
    res.json({ status: 'ok' });
  }
});

app.get('/dead', (_req, res) => {
  res.status(500).json({ status: 'error', note: 'down on purpose' });
});

app.get('/hang', (_req, res) => {
  // Never respond — the monitor's timeout fires first.
  res.on('close', () => undefined);
});

app.get('/', (_req, res) => {
  res.json({
    service: 'demo-target',
    endpoints: ['/ok', '/slow', '/flaky', '/dead', '/hang'],
  });
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`[demo-target] listening on :${PORT}`);
});
