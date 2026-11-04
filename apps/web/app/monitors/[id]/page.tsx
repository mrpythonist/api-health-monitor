import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMonitorDetail, formatAgo, formatTime } from '../../../lib/api';
import StatusBadge from '../../../components/StatusBadge';
import UptimeBar from '../../../components/UptimeBar';
import RefreshTimer from '../../../components/RefreshTimer';
import ResponseTimeChart from '../../../components/ResponseTimeChart';
import MonitorActions from '../../../components/MonitorActions';
import ResolveButton from '../../../components/ResolveButton';

export const dynamic = 'force-dynamic';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export default async function MonitorDetailPage({ params }: { params: { id: string } }) {
  let detail;
  try {
    detail = await getMonitorDetail(params.id);
  } catch {
    notFound();
  }
  const { monitor, uptime, latency24h, recentChecks, incidents } = detail;

  return (
    <div>
      <RefreshTimer seconds={30} />
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
        ← All monitors
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{monitor.name}</h1>
            <StatusBadge status={monitor.lastStatus} enabled={monitor.enabled} />
          </div>
          <p className="mt-1 break-all text-sm text-slate-500">
            {monitor.method} {monitor.url} · expects {monitor.expectedStatus} · every{' '}
            {monitor.intervalSeconds}s · timeout {monitor.timeoutMs}ms
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Public status page: <Link href={`/status/${monitor.slug}`} className="text-emerald-700 underline">/status/{monitor.slug}</Link>
          </p>
        </div>
        <MonitorActions id={monitor.id} enabled={monitor.enabled} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-400">Uptime 24h / 7d / 30d</p>
          <div className="mt-2 space-y-1.5">
            {(['24h', '7d', '30d'] as const).map((w) => (
              <div key={w} className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{w}</span>
                <UptimeBar value={uptime[w]} />
              </div>
            ))}
          </div>
        </div>
        <Stat label="Avg response (24h)" value={latency24h.avgMs != null ? `${latency24h.avgMs}ms` : '—'} />
        <Stat label="Min / Max (24h)" value={latency24h.minMs != null ? `${latency24h.minMs} / ${latency24h.maxMs}ms` : '—'} />
        <Stat label="Consecutive failures" value={String(monitor.consecutiveFails)} />
      </div>

      <div className="mt-6 rounded-xl border bg-white p-4">
        <h2 className="mb-2 font-semibold">Response time — last {recentChecks.length} checks</h2>
        {recentChecks.length > 0 ? (
          <ResponseTimeChart checks={recentChecks} />
        ) : (
          <p className="text-sm text-slate-400">No checks recorded yet.</p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Recent checks</h2>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-slate-400">
                <tr>
                  <th className="py-1 pr-2">Time</th>
                  <th className="py-1 pr-2">Result</th>
                  <th className="py-1 pr-2">Code</th>
                  <th className="py-1 pr-2">Latency</th>
                  <th className="py-1">Error</th>
                </tr>
              </thead>
              <tbody>
                {recentChecks.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{formatTime(c.checkedAt)}</td>
                    <td className="py-1 pr-2">
                      <span className={c.status === 'up' ? 'text-emerald-600' : 'text-red-600'}>
                        {c.status === 'up' ? 'UP' : 'DOWN'}
                      </span>
                    </td>
                    <td className="py-1 pr-2 tabular-nums">{c.statusCode ?? '—'}</td>
                    <td className="py-1 pr-2 tabular-nums">{c.responseTimeMs != null ? `${c.responseTimeMs}ms` : '—'}</td>
                    <td className="max-w-[200px] truncate py-1 text-xs text-slate-500" title={c.error ?? ''}>
                      {c.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Incidents</h2>
          {incidents.length === 0 && <p className="text-sm text-slate-400">No incidents recorded.</p>}
          <div className="space-y-3">
            {incidents.map((i) => (
              <div key={i.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      i.status === 'open' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {i.status === 'open' ? 'Open' : 'Resolved'}
                  </span>
                  {i.status === 'open' && <ResolveButton id={i.id} returnTo={`/monitors/${monitor.id}`} />}
                </div>
                <p className="mt-2 text-sm">{i.cause ?? 'Check failed'}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Started {formatTime(i.startedAt)} ({formatAgo(i.startedAt)}) · {i.failedChecks} failed checks
                  {i.resolvedAt ? ` · resolved ${formatAgo(i.resolvedAt)} (${i.resolvedBy})` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
