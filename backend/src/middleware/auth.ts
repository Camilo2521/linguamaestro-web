import type { NextFunction, Request, Response } from 'express';
import { getUserClient } from '../lib/supabase.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      accessToken?: string;
    }
  }
}

/**
 * Requires `Authorization: Bearer <supabase-access-token>`. Validates the
 * token against Supabase Auth and attaches the caller's id + token to the
 * request. Every route handler that reads/writes user-owned data should use
 * `getUserClient(req.accessToken!)` (not the service client) so RLS still
 * enforces ownership — this middleware only proves *who* is calling, not
 * that they're allowed to touch a specific row.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  // The browser's EventSource API (used for the exam-evaluation SSE stream)
  // can't set custom headers, so that one route is reached with the token
  // as a query param instead — still validated the same way below.
  const token = header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  const supabase = getUserClient(token);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return res.status(401).json({ success: false, error: 'No autenticado' });
  }

  req.userId = user.id;
  req.accessToken = token;
  next();
}
