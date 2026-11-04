import { randomBytes } from 'node:crypto';

/**
 * URL-safe slug for the public status page, e.g. "payments-api-a3f9c1".
 * The random suffix keeps slugs unique even for duplicate names.
 */
export function makeSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'monitor';
  return `${base}-${randomBytes(3).toString('hex')}`;
}
