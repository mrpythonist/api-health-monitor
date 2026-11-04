import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'API Health Monitor',
  description: 'Monitor API endpoints, track uptime, and manage incidents.',
};

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-lg font-bold text-white">
                ✓
              </span>
              <span className="text-lg font-semibold">API Health Monitor</span>
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink href="/">Monitors</NavLink>
              <NavLink href="/incidents">Incidents</NavLink>
              <NavLink href="/status">Status pages</NavLink>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-slate-400">
          Checks run on a BullMQ schedule · results in PostgreSQL · status pages cached in Redis (30s)
        </footer>
      </body>
    </html>
  );
}
