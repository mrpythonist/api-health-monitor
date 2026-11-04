import Link from 'next/link';
import { getIncidents, formatTime, formatAgo } from '../../lib/api';
import RefreshTimer from '../../components/RefreshTimer';
import ResolveButton from '../../components/ResolveButton';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'All' },
];

function duration(startedAt: string, resolvedAt: string | null): string {
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const mins = Math.round((end - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  return h < 48 ? `${h}h ${mins % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = ['open', 'resolved', 'all'].includes(searchParams.status ?? '') ? searchParams.status! : 'open';
  const incidents = await getIncidents(status);

  return (
    <div>
      <RefreshTimer seconds={30} />
      <h1 className="text-2xl font-bold">Incidents</h1>
      <p className="mb-4 text-sm text-slate-500">
        An incident opens after consecutive failed checks hit the threshold and resolves on the
        first successful check — or manually here.
      </p>

      <div className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/incidents?status=${t.key}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              status === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {incidents.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          No {status === 'all' ? '' : status + ' '}incidents.
        </div>
      )}

      <div className="space-y-3">
        {incidents.map((i) => (
          <div key={i.id} className="rounded-xl border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    i.status === 'open' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {i.status === 'open' ? 'Open' : 'Resolved'}
                </span>
                <Link href={i.monitor ? `/monitors/${i.monitor.id}` : '#'} className="font-semibold hover:underline">
                  {i.monitor?.name ?? 'Unknown monitor'}
                </Link>
              </div>
              {i.status === 'open' && <ResolveButton id={i.id} returnTo={`/incidents?status=${status}`} />}
            </div>
            <p className="mt-2 text-sm text-slate-700">{i.cause ?? 'Check failed'}</p>
            <p className="mt-1 text-xs text-slate-400">
              Started {formatTime(i.startedAt)} · duration {duration(i.startedAt, i.resolvedAt)} ·{' '}
              {i.failedChecks} failed checks
              {i.resolvedAt ? ` · resolved ${formatAgo(i.resolvedAt)} (${i.resolvedBy})` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
