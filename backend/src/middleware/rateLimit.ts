import rateLimit from 'express-rate-limit';

/** Login/register/forgot-password: no throttling beyond Supabase's own
 * project-level defaults previously — a real gap for credential stuffing
 * and password-reset-email spam. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
});

/** Exam-attempt creation gates real Whisper + Claude API spend downstream
 * (via the evaluate route) — throttle it independently of the generic
 * per-IP limits above. */
export const examAttemptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos de examen. Intenta de nuevo más tarde.' },
});
