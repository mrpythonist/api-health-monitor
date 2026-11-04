import Link from 'next/link';
import { getPublicOverview, formatAgo } from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';
import UptimeBar from '../../components/UptimeBar';

export const dynamic = 'force-dynamic';

export default async function StatusIndexPage() {
  const overview = await getPublicOverview();

  return (
    <div>
      <div
        className={`mb-6 rounded-xl p-5 text-white ${
          overview.overall === 'operational' ? 'bg-emerald-600' : 'bg-amber-600'
        }`}
      >
        <h1 className="text-xl font-bold">
          {overview.overall === 'operational' ? 'All systems operational' : 'Some systems degraded'}
        </h1>
        <p className="text-sm opacity-90">Updated {formatAgo(overview.generatedAt)}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {overview.monitors.map((m) => (
          <Link
            key={m.id}
            href={`/status/${m.slug}`}
            className="rounded-xl border bg-white p-5 transition hover:shadow-md"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{m.name}</h2>
                <p className="truncate text-sm text-slate-500" title={m.url}>
                  {m.url}
                </p>
              </div>
              <StatusBadge status={m.lastStatus} />
            </div>
            <UptimeBar value={m.uptime24h} />
          </Link>
        ))}
      </div>

      {overview.monitors.length === 0 && (
        <div className="rounded-xl border bg-white p-8 text-center text-slate-500">
          No public monitors yet.
        </div>
      )}
    </div>
  );
}
