import type { CheckStatus } from '../lib/api';

const styles: Record<string, string> = {
  up: 'bg-emerald-100 text-emerald-800',
  down: 'bg-red-100 text-red-800',
  unknown: 'bg-slate-100 text-slate-600',
  paused: 'bg-amber-100 text-amber-800',
};

export default function StatusBadge({
  status,
  enabled = true,
}: {
  status: CheckStatus | null;
  enabled?: boolean;
}) {
  if (!enabled) {
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.paused}`}>
        Paused
      </span>
    );
  }
  const key = status ?? 'unknown';
  const label = status === 'up' ? 'Up' : status === 'down' ? 'Down' : 'No data';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[key]}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status === 'up' ? 'bg-emerald-500' : status === 'down' ? 'bg-red-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  );
}
