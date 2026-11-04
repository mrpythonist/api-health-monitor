export interface WebhookPayload {
  event: 'incident.opened' | 'incident.resolved';
  monitor: { id: string; name: string; url: string };
  incident: {
    id: string;
    cause: string | null;
    failedChecks: number;
    startedAt: string;
    resolvedAt: string | null;
  };
  checkedAt: string;
}

/**
 * Fire-and-forget incident webhook (Slack-style integrations, PagerDuty
 * bridges, etc.). Never throws: a failing webhook must not fail the check.
 */
export async function sendIncidentWebhook(url: string, payload: WebhookPayload): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'api-health-monitor/1.0' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    console.warn(`[webhook] POST ${url} failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
