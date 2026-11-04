'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-fetch server components on an interval so the dashboard stays live. */
export default function RefreshTimer({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
