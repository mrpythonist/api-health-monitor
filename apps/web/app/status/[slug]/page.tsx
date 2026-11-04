import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicStatusPage, formatAgo, formatTime } from '../../../lib/api';
import StatusBadge from '../../../components/StatusBadge';
import UptimeBar from '../../../components/UptimeBar';

export const dynamic = 'force-dynamic';

export default async function PublicStatusPage({ params }: { params: { slug: string } }) {
  let page;
  try {
    page = await getPublicStatusPage(params.slug);
  } catch {
    notFound();
  }
  const { monitor, uptime, openIncident, recentIncidents, recentChecks } = page;
  const degraded = monitor.lastStatus === 'down' || openIncident != null;

  return (
    <div>
      <Link href="/status" className="text-sm text-slate-500 hover:text-slate-800">
        ← All systems
      </Link>

      <div className={`mt-2 rounded-xl p-6 text-white ${degraded ? 'bg-red-600' : 'bg-emerald-600'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{monitor.name}</h1>
            <p className="text-sm opacity-90">{monitor.url}</p>
          </div>
          <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold">
            {degraded ? 'Incident in progress' : 'Operational'}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {(['24h', '7d', '30d'] as const).map((w) => (
          <div key={w} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-400">Uptime · last {w}</p>
            <div className="mt-2">
              <UptimeBar value={uptime[w]} />
            </div>
          </div>
        ))}
      </div>

      {openIncident && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-800">Ongoing incident</h2>
          <p className="mt-1 text-sm text-red-700">{openIncident.cause ?? 'Checks are failing'}</p>
          <p className="mt-1 text-xs text-red-600">
            Started {formatTime(openIncident.startedAt)} ({formatAgo(openIncident.startedAt)})
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Recent checks</h2>
          <div className="flex flex-wrap gap-1.5">
            {recentChecks.map((c, i) => (
              <span
                key={i}
                title={`${c.status.toUpperCase()} · ${c.statusCode ?? ''} · ${c.responseTimeMs ?? '—'}ms · ${formatTime(c.checkedAt)}`}
                className={`h-6 w-2 rounded-sm ${c.status === 'up' ? 'bg-emerald-500' : 'bg-red-500'}`}
              />
            ))}
          </div>
          {recentChecks.length === 0 && <p className="text-sm text-slate-400">No checks yet.</p>}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Incident history</h2>
          {recentIncidents.length === 0 && (
            <p className="text-sm text-slate-400">No past incidents. Quiet is good.</p>
          )}
          <div className="space-y-2">
            {recentIncidents.map((i) => (
              <div key={i.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{i.cause ?? 'Checks failed'}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatTime(i.startedAt)} → {i.resolvedAt ? formatTime(i.resolvedAt) : '…'} ·{' '}
                  {i.failedChecks} failed checks
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <StatusBadge status={monitor.lastStatus} />
        <span className="text-xs text-slate-400">
          Last checked {formatAgo(monitor.lastCheckedAt)} ·{' '}
          <Link href={`/status/${monitor.slug}`} className="underline">
            share this page
          </Link>
        </span>
      </div>
    </div>
  );
}
