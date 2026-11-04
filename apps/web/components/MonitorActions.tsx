'use client';

import { useState } from 'react';
import { triggerCheck, setMonitorEnabled, deleteMonitor } from '../app/actions';

function btn(base: string) {
  return `rounded-md border px-3 py-1.5 text-sm font-medium ${base}`;
}

/** Monitor management buttons on the detail page (server actions do the API calls). */
export default function MonitorActions({ id, enabled }: { id: string; enabled: boolean }) {
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        disabled={busy}
        onClick={() => run(() => triggerCheck(id))}
        className={btn('border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50')}
      >
        Check now
      </button>
      <button
        disabled={busy}
        onClick={() => run(() => setMonitorEnabled(id, !enabled))}
        className={btn('bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50')}
      >
        {enabled ? 'Pause' : 'Resume'}
      </button>
      <button
        disabled={busy}
        onClick={() => {
          if (confirm('Delete this monitor and all its history?')) run(() => deleteMonitor(id));
        }}
        className={btn('bg-white text-red-600 hover:bg-red-50 disabled:opacity-50')}
      >
        Delete
      </button>
    </div>
  );
}
