import { Router } from 'express';
import { z } from 'zod';
import { anonClient, getUserClient } from '../lib/supabase.js';
import { loginSchema, registerSchema, forgotPasswordSchema } from '../validations/auth.schema.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors });
  }

  const { data, error } = await anonClient.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) return res.status(400).json({ success: false, error: error.message });

  if (data.user && !data.session) {
    // Email confirmation is required by this Supabase project's auth settings.
    return res.json({ success: true, data: { needsConfirmation: true, user: data.user } });
  }

  return res.json({ success: true, data: { session: data.session, user: data.user } });
});

router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors });
  }

  const { data, error } = await anonClient.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    const message = error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message;
    return res.status(401).json({ success: false, error: message });
  }

  return res.json({ success: true, data: { session: data.session, user: data.user } });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'refreshToken requerido' });

  const { data, error } = await anonClient.auth.refreshSession({ refresh_token: parsed.data.refreshToken });
  if (error || !data.session) return res.status(401).json({ success: false, error: 'Sesión expirada' });

  return res.json({ success: true, data: { session: data.session, user: data.user } });
});

router.post('/forgot-password', authLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }

  // `redirectTo` is embedded verbatim in the password-reset email Supabase
  // sends — accepting it unchecked from the request body would let an
  // attacker craft a reset email pointing anywhere. Only honor it when it
  // actually points back at our own frontend origin; otherwise fall back to
  // whatever default redirect is configured in the Supabase project.
  const requestedRedirect = req.body.redirectTo as string | undefined;
  const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  let redirectTo: string | undefined;
  if (requestedRedirect) {
    try {
      redirectTo = new URL(requestedRedirect).origin === allowedOrigin ? requestedRedirect : undefined;
    } catch {
      redirectTo = undefined;
    }
  }

  const { error } = await anonClient.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

router.post('/logout', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.accessToken!);
  await supabase.auth.signOut();
  return res.json({ success: true });
});

// Bootstraps the frontend session store: profile row + active enrollments.
router.get('/me', requireAuth, async (req, res) => {
  const supabase = getUserClient(req.accessToken!);
  const [{ data: userProfile }, { data: enrollments }] = await Promise.all([
    supabase.from('users').select('*').eq('id', req.userId!).single(),
    supabase.from('enrollments').select('*').eq('user_id', req.userId!).eq('active', true),
  ]);

  return res.json({ success: true, data: { user: userProfile, enrollments: enrollments ?? [] } });
});

export default router;
