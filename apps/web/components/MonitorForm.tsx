'use client';

import { createMonitor } from '../app/actions';

/** Register a new endpoint to monitor. Posts to a server action (API key stays server-side). */
export default function MonitorForm() {
  return (
    <form
      action={createMonitor}
      className="mb-8 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1fr_2fr_auto_auto_auto]"
    >
      <input
        name="name"
        required
        placeholder="Name — e.g. Payments API"
        className="rounded-md border px-3 py-2 text-sm"
      />
      <input
        name="url"
        required
        type="url"
        placeholder="https://api.example.com/health"
        className="rounded-md border px-3 py-2 text-sm"
      />
      <input
        name="intervalSeconds"
        type="number"
        min={30}
        defaultValue={60}
        title="Check interval (seconds, min 30)"
        className="w-28 rounded-md border px-3 py-2 text-sm"
      />
      <input
        name="timeoutMs"
        type="number"
        min={1000}
        step={1000}
        defaultValue={10000}
        title="Timeout (ms)"
        className="w-28 rounded-md border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Add monitor
      </button>
    </form>
  );
}
