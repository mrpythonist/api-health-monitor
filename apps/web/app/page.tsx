import Link from 'next/link';
import { getMonitors, formatAgo } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import UptimeBar from '../components/UptimeBar';
import RefreshTimer from '../components/RefreshTimer';
import MonitorForm from '../components/MonitorForm';

export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const monitors = await getMonitors();
  const openCount = monitors.filter((m) => m.openIncident).length;
  const downCount = monitors.filter((m) => m.enabled && m.lastStatus === 'down').length;

  return (
    <div>
      <RefreshTimer seconds={30} />
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitors</h1>
          <p className="text-sm text-slate-500">
            {monitors.length} endpoints · {downCount} down · {openCount} open incidents
          </p>
        </div>
      </div>

      <MonitorForm />

      {monitors.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          No monitors yet. Add your first endpoint above, or run the seed script to load the demo
          target&apos;s healthy / slow / flaky / down / hanging endpoints.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {monitors.map((m) => (
          <Link
            key={m.id}
            href={`/monitors/${m.id}`}
            className="rounded-xl border bg-white p-5 transition hover:shadow-md"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{m.name}</h2>
                <p className="truncate text-sm text-slate-500" title={m.url}>
                  {m.method} {m.url}
                </p>
              </div>
              <StatusBadge status={m.lastStatus} enabled={m.enabled} />
            </div>
            {m.openIncident && (
              <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                Incident open since {formatAgo(m.openIncident.startedAt)}
                {m.openIncident.cause ? ` — ${m.openIncident.cause}` : ''}
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="mb-1 text-xs text-slate-400">Uptime (24h)</p>
                <UptimeBar value={m.uptime24h} />
              </div>
              <div className="text-right">
                <p className="mb-1 text-xs text-slate-400">Avg response (24h)</p>
                <p className="font-medium tabular-nums">
                  {m.avgResponseMs24h != null ? `${m.avgResponseMs24h}ms` : '—'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  every {m.intervalSeconds}s · checked {formatAgo(m.lastCheckedAt)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
