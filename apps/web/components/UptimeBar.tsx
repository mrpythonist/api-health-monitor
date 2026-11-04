export default function UptimeBar({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-sm text-slate-400">No data yet</span>;
  }
  const color = value >= 99 ? 'bg-emerald-500' : value >= 95 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-sm font-medium tabular-nums">{value.toFixed(2)}%</span>
    </div>
  );
}
