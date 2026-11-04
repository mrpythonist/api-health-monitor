export interface CheckOptions {
  url: string;
  method: string;
  headers?: Record<string, string> | null;
  expectedStatus: number;
  timeoutMs: number;
}

export interface CheckOutcome {
  status: 'up' | 'down';
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
}

/**
 * Perform one HTTP health check with a hard timeout. Response time is measured
 * from request start to response headers received (time-to-first-byte), which
 * is what matters for availability monitoring. A check is "up" only when the
 * HTTP status exactly matches the monitor's expected status.
 */
export async function performCheck(opts: CheckOptions): Promise<CheckOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(opts.url, {
      method: opts.method,
      headers: (opts.headers ?? {}) as Record<string, string>,
      signal: controller.signal,
      redirect: 'follow',
    });
    const ms = Math.round(performance.now() - start);
    // Best effort: release the socket without waiting for the body.
    res.body?.cancel().catch(() => undefined);
    if (res.status === opts.expectedStatus) {
      return { status: 'up', statusCode: res.status, responseTimeMs: ms, error: null };
    }
    return {
      status: 'down',
      statusCode: res.status,
      responseTimeMs: ms,
      error: `unexpected status ${res.status} (expected ${opts.expectedStatus})`,
    };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `timeout after ${opts.timeoutMs}ms`
          : err.message
        : 'unknown error';
    return { status: 'down', statusCode: null, responseTimeMs: null, error: message.slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}
