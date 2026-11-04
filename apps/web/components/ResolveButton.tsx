'use client';

import { useState } from 'react';
import { resolveIncident } from '../app/actions';

export default function ResolveButton({ id, returnTo }: { id: string; returnTo: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await resolveIncident(id, returnTo);
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      Resolve
    </button>
  );
}
