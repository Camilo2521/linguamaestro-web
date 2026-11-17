import { Router } from 'express';
import { z } from 'zod';
import { getUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { MAX_DAILY_MINUTES, MAX_XP_PER_MINUTE, validateSessionDuration, checkDailyLimit, getTodayTotalMinutes } from '../utils/activity-limits.js';

const router = Router();
router.use(requireAuth);

const logSchema = z.object({
  enrollmentId: z.string().uuid(),
  // Mirrors the DB check constraint on activity_logs.activity_type
  // (0001_init.sql) — a value outside this set would previously only fail
  // at insert time, after the daily-limit query had already run.
  activityType: z.enum(['lesson', 'srs', 'speaking', 'listening', 'writing']),
  durationMinutes: z.number().int(),
  xpEarned: z.number().int().min(0),
  metadata: z.record(z.unknown()).optional(),
});

router.post('/', async (req, res) => {
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Datos inválidos' });
  const { enrollmentId, activityType, durationMinutes, xpEarned, metadata } = parsed.data;

  const supabase = getUserClient(req.accessToken!);

  const sessionCheck = validateSessionDuration(durationMinutes);
  if (!sessionCheck.valid) return res.status(400).json({ success: false, error: sessionCheck.error });

  const totalToday = await getTodayTotalMinutes(supabase, req.userId!);
  const limitCheck = checkDailyLimit(totalToday, durationMinutes);
  if (!limitCheck.allowed) {
    return res.status(429).json({ success: false, blocked: true, error: `Límite diario alcanzado (${MAX_DAILY_MINUTES} min)` });
  }

  // xpEarned is client-supplied — bound it so a tampered request can't
  // insert an arbitrary XP total straight into activity_logs.
  const clampedXp = Math.max(0, Math.min(xpEarned, durationMinutes * MAX_XP_PER_MINUTE));

  const { error } = await supabase.from('activity_logs').insert({
    user_id: req.userId,
    enrollment_id: enrollmentId,
    activity_type: activityType,
    duration_minutes: durationMinutes,
    xp_earned: clampedXp,
    metadata,
  });

  if (error) return res.status(400).json({ success: false, error: error.message });

  const { error: streakError } = await supabase.rpc('update_streak', { p_user_id: req.userId });
  if (streakError) console.error(`update_streak failed for user ${req.userId}:`, streakError.message);
  return res.json({ success: true });
});

router.get('/daily', async (req, res) => {
  const supabase = getUserClient(req.accessToken!);
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('activity_logs')
    .select('duration_minutes, xp_earned, activity_type, created_at')
    .eq('user_id', req.userId)
    .gte('created_at', `${today}T00:00:00`)
    .order('created_at', { ascending: true });

  if (error) return res.status(400).json({ success: false, error: error.message });

  const totalMinutes = (data ?? []).reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
  const totalXP = (data ?? []).reduce((s, l) => s + (l.xp_earned ?? 0), 0);

  return res.json({ success: true, data: { logs: data ?? [], totalMinutes, totalXP, limitMinutes: MAX_DAILY_MINUTES } });
});

export default router;
