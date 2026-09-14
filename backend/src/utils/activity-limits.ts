export const MAX_DAILY_MINUTES = 360;
export const MIN_SESSION_MINUTES = 15;
// Generous ceiling above the real per-activity rates (useActivityTracker
// defaults to 10 xp/min) — bounds a client-supplied xpEarned value without
// trusting it outright, since logActivityAction takes it as a raw argument.
export const MAX_XP_PER_MINUTE = 20;

export function validateSessionDuration(durationMinutes: number): { valid: boolean; error?: string } {
  if (durationMinutes < MIN_SESSION_MINUTES) {
    return { valid: false, error: `Sesión mínima: ${MIN_SESSION_MINUTES} minutos` };
  }
  return { valid: true };
}

export function checkDailyLimit(
  existingMinutes: number,
  newMinutes: number,
): { allowed: boolean; remaining: number } {
  const remaining = MAX_DAILY_MINUTES - existingMinutes;
  if (existingMinutes + newMinutes > MAX_DAILY_MINUTES) {
    return { allowed: false, remaining: Math.max(0, remaining) };
  }
  return { allowed: true, remaining };
}

export function computeXP(durationMinutes: number, xpPerMinute: number): number {
  return Math.max(0, durationMinutes * xpPerMinute);
}
