/**
 * Pure uptime / latency math, operating on in-memory check rows so it can be
 * unit-tested without a database. All percentages are rounded to 2 decimals.
 */

export type CheckStatus = 'up' | 'down';

/** Uptime % over a set of checks, or null when there are no checks. */
export function uptimePercent(statuses: CheckStatus[]): number | null {
  if (statuses.length === 0) return null;
  const up = statuses.filter((s) => s === 'up').length;
  return Math.round((up / statuses.length) * 10000) / 100;
}

/**
 * Percentile of an ascending-sorted number array (linear interpolation),
 * or null for an empty array. Input must already be sorted ascending.
 */
export function percentileSorted(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (p < 0 || p > 100) throw new Error('percentile must be between 0 and 100');
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sortedAsc[lo];
  const frac = rank - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

/** Average of a number array, rounded to 1 decimal, or null when empty. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}
