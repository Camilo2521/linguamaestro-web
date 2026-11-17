import type { SupabaseClient } from '@supabase/supabase-js';

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

export async function getTodayTotalMinutes(supabase: SupabaseClient, userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from('activity_logs')
    .select('duration_minutes')
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);
  return (data ?? []).reduce((sum: number, l: { duration_minutes: number | null }) => sum + (l.duration_minutes ?? 0), 0);
}
