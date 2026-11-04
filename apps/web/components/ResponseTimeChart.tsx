import type { CheckResult } from '../lib/api';

/**
 * SVG sparkline of response times for recent checks (oldest → newest).
 * Up checks are emerald dots; down checks are red dots pinned to the top.
 */
export default function ResponseTimeChart({ checks }: { checks: CheckResult[] }) {
  const ordered = [...checks].reverse();
  const W = 640;
  const H = 160;
  const PAD = 12;
  const up = ordered.filter((c) => c.status === 'up' && c.responseTimeMs != null);
  const maxMs = Math.max(1, ...up.map((c) => c.responseTimeMs as number));

  const x = (i: number) => PAD + (i / Math.max(1, ordered.length - 1)) * (W - 2 * PAD);
  const y = (ms: number) => H - PAD - (ms / maxMs) * (H - 2 * PAD);

  const line = up
    .map((c) => {
      const i = ordered.indexOf(c);
      return `${x(i).toFixed(1)},${y(c.responseTimeMs as number).toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full min-w-[480px]" role="img" aria-label="Response time chart">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke="#e2e8f0" strokeDasharray="4 4" />
        ))}
        {line && <polyline points={line} fill="none" stroke="#10b981" strokeWidth="2" />}
        {ordered.map((c, i) =>
          c.status === 'up' && c.responseTimeMs != null ? (
            <circle key={c.id} cx={x(i)} cy={y(c.responseTimeMs)} r="3" fill="#10b981">
              <title>{`${c.responseTimeMs}ms · ${new Date(c.checkedAt).toLocaleString()}`}</title>
            </circle>
          ) : (
            <circle key={c.id} cx={x(i)} cy={PAD} r="4" fill="#ef4444">
              <title>{`DOWN · ${c.error ?? c.statusCode ?? ''} · ${new Date(c.checkedAt).toLocaleString()}`}</title>
            </circle>
          ),
        )}
        <text x={W - PAD} y={PAD + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
          max {maxMs}ms
        </text>
      </svg>
    </div>
  );
}
