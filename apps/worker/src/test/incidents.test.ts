import { decideIncident, type IncidentInput } from '../incidents';

/**
 * Unit checks for the incident state machine. No database needed.
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

const base: IncidentInput = {
  checkStatus: 'down',
  consecutiveFailsBefore: 0,
  openIncident: null,
  threshold: 2,
};

// 1. First failure below threshold: count it, no incident.
check('1st failure below threshold -> none', decideIncident(base), {
  type: 'none',
  consecutiveFails: 1,
});

// 2. Second consecutive failure hits the threshold: open.
check('2nd failure hits threshold -> open', decideIncident({ ...base, consecutiveFailsBefore: 1 }), {
  type: 'open',
  consecutiveFails: 2,
});

// 3. Further failures while open: bump the counter, no new incident.
check(
  'failure while open -> count',
  decideIncident({ ...base, consecutiveFailsBefore: 2, openIncident: { id: 'inc_1' } }),
  { type: 'count', consecutiveFails: 3, incidentId: 'inc_1' },
);

// 4. Success with no open incident: reset, nothing to do.
check(
  'success, no incident -> none',
  decideIncident({ ...base, checkStatus: 'up', consecutiveFailsBefore: 1 }),
  { type: 'none', consecutiveFails: 0 },
);

// 5. Success with an open incident: resolve it.
check(
  'success with open incident -> resolve',
  decideIncident({ ...base, checkStatus: 'up', openIncident: { id: 'inc_1' } }),
  { type: 'resolve', consecutiveFails: 0, incidentId: 'inc_1' },
);

// 6. A success between failures resets the streak: next failure starts at 1.
const afterRecovery = decideIncident({ ...base, checkStatus: 'up', consecutiveFailsBefore: 1 });
check('recovery resets counter', afterRecovery.consecutiveFails, 0);
check(
  'failure after recovery -> none (streak restarted)',
  decideIncident({ ...base, consecutiveFailsBefore: afterRecovery.consecutiveFails }),
  { type: 'none', consecutiveFails: 1 },
);

// 7. Threshold of 1: every single failure opens an incident.
check(
  'threshold 1 -> immediate open',
  decideIncident({ ...base, threshold: 1 }),
  { type: 'open', consecutiveFails: 1 },
);

// 8. Threshold is clamped to >= 1 even if misconfigured.
check(
  'threshold 0 clamps to 1',
  decideIncident({ ...base, threshold: 0 }),
  { type: 'open', consecutiveFails: 1 },
);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
