import { randomBytes } from 'node:crypto';
import { prisma } from './db';
import { makeSlug } from './lib/slug';
import { ensureSchedule } from './scheduler';

/**
 * Demo seed. Creates monitors against the demo target (apps/demo-target),
 * which exposes /ok, /slow, /flaky, /dead and /hang endpoints so you can
 * watch checks, incidents and recovery happen live.
 *
 * Run with: npm run seed
 * In Docker: docker compose run --rm -e DEMO_TARGET_URL=http://demo-target:4000 api npm run seed
 */

const TARGET = process.env.DEMO_TARGET_URL ?? 'http://localhost:4000';

interface SeedMonitor {
  name: string;
  path: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatus: number;
}

const MONITORS: SeedMonitor[] = [
  { name: 'Demo API — healthy', path: '/ok', intervalSeconds: 30, timeoutMs: 10000, expectedStatus: 200 },
  { name: 'Demo API — slow', path: '/slow', intervalSeconds: 60, timeoutMs: 10000, expectedStatus: 200 },
  { name: 'Demo API — flaky', path: '/flaky', intervalSeconds: 30, timeoutMs: 10000, expectedStatus: 200 },
  { name: 'Demo API — down', path: '/dead', intervalSeconds: 30, timeoutMs: 10000, expectedStatus: 200 },
  { name: 'Demo API — hanging', path: '/hang', intervalSeconds: 60, timeoutMs: 5000, expectedStatus: 200 },
];

async function main(): Promise<void> {
  let apiKey = process.env.ADMIN_API_KEY;
  if (!apiKey) {
    apiKey = randomBytes(24).toString('hex');
    console.log(`[seed] ADMIN_API_KEY was not set — generated one for this run: ${apiKey}`);
    console.log('[seed] Set ADMIN_API_KEY to this value in your .env to keep using it.');
  } else {
    console.log('[seed] using ADMIN_API_KEY from the environment');
  }

  for (const m of MONITORS) {
    const existing = await prisma.monitor.findFirst({
      where: { url: `${TARGET}${m.path}` },
    });
    if (existing) {
      console.log(`[seed] already exists: ${existing.name} (${existing.url})`);
      continue;
    }
    const monitor = await prisma.monitor.create({
      data: {
        name: m.name,
        slug: makeSlug(m.name),
        url: `${TARGET}${m.path}`,
        method: 'GET',
        expectedStatus: m.expectedStatus,
        timeoutMs: m.timeoutMs,
        intervalSeconds: m.intervalSeconds,
      },
    });
    const scheduled = await ensureSchedule(monitor);
    console.log(
      `[seed] created: ${monitor.name} -> ${monitor.url} (status page: /status/${monitor.slug}, scheduled: ${scheduled})`,
    );
  }

  console.log('\n[seed] done. Management API key (x-api-key header):');
  console.log(`       ${apiKey}`);
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
