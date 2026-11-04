// Server-side API client. API_URL / API_KEY are server-only env vars — the
// browser never sees the management key. Public status pages use the keyless
// /status endpoints instead.

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const API_KEY = process.env.API_KEY ?? '';

export type CheckStatus = 'up' | 'down';

export interface MonitorSummary {
  id: string;
  name: string;
  slug: string;
  url: string;
  method: string;
  expectedStatus: number;
  timeoutMs: number;
  intervalSeconds: number;
  enabled: boolean;
  consecutiveFails: number;
  lastStatus: CheckStatus | null;
  lastCheckedAt: string | null;
  uptime24h: number | null;
  avgResponseMs24h: number | null;
  openIncident: { monitorId: string; startedAt: string; cause: string | null } | null;
}

export interface CheckResult {
  id: string;
  status: CheckStatus;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
  checkedAt: string;
}

export interface Incident {
  id: string;
  monitorId: string;
  status: 'open' | 'resolved';
  cause: string | null;
  failedChecks: number;
  startedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  monitor?: { id: string; name: string; url: string; slug: string };
}

export interface MonitorDetail {
  monitor: MonitorSummary;
  uptime: { '24h': number | null; '7d': number | null; '30d': number | null };
  latency24h: { avgMs: number | null; minMs: number | null; maxMs: number | null; samples: number };
  recentChecks: CheckResult[];
  incidents: Incident[];
}

export interface PublicStatusPage {
  generatedAt: string;
  monitor: {
    name: string;
    slug: string;
    url: string;
    lastStatus: CheckStatus | null;
    lastCheckedAt: string | null;
  };
  uptime: { '24h': number | null; '7d': number | null; '30d': number | null };
  openIncident: Incident | null;
  recentIncidents: Incident[];
  recentChecks: Array<Pick<CheckResult, 'status' | 'statusCode' | 'responseTimeMs' | 'checkedAt'>>;
}

export interface PublicOverview {
  generatedAt: string;
  overall: 'operational' | 'degraded';
  monitors: Array<{
    id: string;
    name: string;
    slug: string;
    url: string;
    lastStatus: CheckStatus | null;
    lastCheckedAt: string | null;
    uptime24h: number | null;
  }>;
}

async function authed(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function pub(path: string) {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const getMonitors = (): Promise<MonitorSummary[]> => authed('/api/monitors');
export const getMonitorDetail = (id: string): Promise<MonitorDetail> =>
  authed(`/api/monitors/${id}`);
export const getIncidents = (status: string): Promise<Incident[]> =>
  authed(`/api/incidents?status=${status}`);
export const getPublicOverview = (): Promise<PublicOverview> => pub('/status');
export const getPublicStatusPage = (slug: string): Promise<PublicStatusPage> => pub(`/status/${slug}`);

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function formatAgo(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
