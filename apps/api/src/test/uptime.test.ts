import { uptimePercent, percentileSorted, average } from '../lib/uptime';
import { makeSlug } from '../lib/slug';

/**
 * Unit checks for uptime math + slug generation. No database needed.
 * Run with: npm test
 * Exits non-zero on the first failure.
 */

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`ok   ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

// --- uptimePercent ---
check('uptime: empty -> null', uptimePercent([]), null);
check('uptime: all up -> 100', uptimePercent(['up', 'up', 'up']), 100);
check('uptime: all down -> 0', uptimePercent(['down', 'down']), 0);
check('uptime: 3 of 4 -> 75', uptimePercent(['up', 'up', 'up', 'down']), 75);
check('uptime: rounds to 2 decimals', uptimePercent(['up', 'up', 'down']), 66.67);

// --- percentileSorted ---
check('percentile: empty -> null', percentileSorted([], 95), null);
check('percentile: single value', percentileSorted([120], 95), 120);
check('percentile: p50 of 1..5 -> 3', percentileSorted([1, 2, 3, 4, 5], 50), 3);
check('percentile: p0 -> min', percentileSorted([10, 20, 30], 0), 10);
check('percentile: p100 -> max', percentileSorted([10, 20, 30], 100), 30);
check(
  'percentile: interpolates',
  Math.round((percentileSorted([0, 100], 25) ?? 0) * 100) / 100,
  25,
);

// --- average ---
check('average: empty -> null', average([]), null);
check('average: simple', average([100, 200, 300]), 200);
check('average: rounds to 1 decimal', average([1, 2]), 1.5);

// --- makeSlug ---
const slug = makeSlug('Payments API');
check('slug: starts with kebab name', slug.startsWith('payments-api-'), true);
check('slug: unique suffixes', makeSlug('X') === makeSlug('X'), false);
check('slug: strips special chars', makeSlug('  API @ v2!! ').startsWith('api-v2-'), true);
check('slug: empty name fallback', makeSlug('!!!').startsWith('monitor-'), true);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
