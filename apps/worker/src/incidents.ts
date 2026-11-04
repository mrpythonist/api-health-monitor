/**
 * Pure incident state machine. Given the previous monitor state and the new
 * check outcome, decide what to do — without touching the database, so the
 * rules are unit-testable.
 *
 * Rules:
 * - A successful check resets the consecutive-failure counter. If an incident
 *   was open, it resolves (resolvedBy: "worker").
 * - A failed check increments the counter. An incident opens when the counter
 *   reaches the threshold and none is open yet; further failures while open
 *   just bump the incident's failedChecks counter.
 */

export interface IncidentInput {
  checkStatus: 'up' | 'down';
  consecutiveFailsBefore: number;
  openIncident: { id: string } | null;
  threshold: number;
}

export type IncidentAction =
  | { type: 'none'; consecutiveFails: number }
  | { type: 'open'; consecutiveFails: number }
  | { type: 'count'; consecutiveFails: number; incidentId: string }
  | { type: 'resolve'; consecutiveFails: number; incidentId: string };

export function decideIncident(input: IncidentInput): IncidentAction {
  const threshold = Math.max(1, Math.floor(input.threshold));
  if (input.checkStatus === 'up') {
    if (input.openIncident) {
      return { type: 'resolve', consecutiveFails: 0, incidentId: input.openIncident.id };
    }
    return { type: 'none', consecutiveFails: 0 };
  }
  const consecutiveFails = input.consecutiveFailsBefore + 1;
  if (input.openIncident) {
    return { type: 'count', consecutiveFails, incidentId: input.openIncident.id };
  }
  if (consecutiveFails >= threshold) {
    return { type: 'open', consecutiveFails };
  }
  return { type: 'none', consecutiveFails };
}
