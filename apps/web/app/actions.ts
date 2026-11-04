'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const API_KEY = process.env.API_KEY ?? '';

async function authed(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function createMonitor(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const intervalSeconds = Number(formData.get('intervalSeconds') ?? 60);
  const timeoutMs = Number(formData.get('timeoutMs') ?? 10000);
  await authed('/api/monitors', {
    method: 'POST',
    body: JSON.stringify({ name, url, intervalSeconds, timeoutMs }),
  });
  revalidatePath('/');
}

export async function triggerCheck(id: string): Promise<void> {
  await authed(`/api/monitors/${id}/check`, { method: 'POST' });
  revalidatePath(`/monitors/${id}`);
  revalidatePath('/');
}

export async function setMonitorEnabled(id: string, enabled: boolean): Promise<void> {
  await authed(`/api/monitors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
  revalidatePath(`/monitors/${id}`);
  revalidatePath('/');
}

export async function deleteMonitor(id: string): Promise<void> {
  await authed(`/api/monitors/${id}`, { method: 'DELETE' });
  redirect('/');
}

export async function resolveIncident(id: string, returnTo: string): Promise<void> {
  await authed(`/api/incidents/${id}/resolve`, { method: 'PATCH' });
  revalidatePath(returnTo);
}
