import type { NextFunction, Request, Response } from 'express';

/**
 * Management API authentication. Expects `x-api-key: <ADMIN_API_KEY>`.
 * The public status pages (/status/*) intentionally skip this middleware.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    res.status(500).json({ error: 'server misconfigured: ADMIN_API_KEY missing' });
    return;
  }
  const provided = req.header('x-api-key');
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'invalid or missing x-api-key' });
    return;
  }
  next();
}
