import { Router } from 'express';
import { z } from 'zod';
import { getUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const supabase = getUserClient(req.accessToken!);

  const [{ data: profile }, { data: enrollmentsRaw }] = await Promise.all([
    supabase.from('users').select('*').eq('id', req.userId).single(),
    supabase.from('enrollments').select('*').eq('user_id', req.userId).eq('active', true),
  ]);

  const enrollment = enrollmentsRaw?.[0] ?? null;
  if (!enrollment) {
    return res.json({ success: true, data: { profile, enrollment: null, stats: null, activeDates: [], nextLesson: null } });
  }

  const [{ data: srsItems }, { data: activityLogs }, { data: lessonProgress }, { data: levelLessons }] = await Promise.all([
    supabase.from('srs_items').select('id').eq('enrollment_id', enrollment.id).lte('next_review_at', new Date().toISOString()),
    supabase.from('activity_logs').select('created_at').eq('user_id', req.userId).gte('created_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()),
    supabase.from('lesson_progress').select('lesson_id, completed').eq('enrollment_id', enrollment.id),
    supabase.from('lessons').select('id, title, level').eq('language_code', enrollment.language_code).eq('level', enrollment.current_level).order('order_index', { ascending: true }),
  ]);

  const activeDates = [...new Set((activityLogs ?? []).map((l) => (l.created_at as string).slice(0, 10)))];
  const completedLessonIds = new Set((lessonProgress ?? []).filter((p) => p.completed).map((p) => p.lesson_id));
  const nextLesson = (levelLessons ?? []).find((l) => !completedLessonIds.has(l.id)) ?? null;

  const stats = {
    total_study_hours: enrollment.total_study_hours ?? 0,
    srs_cards_due: srsItems?.length ?? 0,
    lessons_completed: completedLessonIds.size,
    current_streak: profile?.current_streak ?? 0,
  };

  return res.json({ success: true, data: { profile, enrollment, stats, activeDates, nextLesson } });
});

router.get('/progress', async (req, res) => {
  const supabase = getUserClient(req.accessToken!);

  // Not .single(): a user can have more than one active enrollment
  // (multi-language support).
  const [{ data: enrollments }, { data: logs }] = await Promise.all([
    supabase.from('enrollments').select('*').eq('user_id', req.userId).eq('active', true),
    supabase.from('activity_logs').select('duration_minutes, xp_earned, activity_type, created_at').eq('user_id', req.userId).order('created_at', { ascending: false }).limit(30),
  ]);

  const enrollment = enrollments?.[0] ?? null;
  if (!enrollment) return res.status(404).json({ success: false, error: 'No hay inscripción activa' });

  return res.json({ success: true, data: { enrollment, logs: logs ?? [] } });
});

const dailyGoalSchema = z.object({ dailyGoalMinutes: z.number().int().min(5).max(240) });

router.patch('/settings/daily-goal', async (req, res) => {
  const parsed = dailyGoalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Valor inválido' });

  const supabase = getUserClient(req.accessToken!);
  const { error } = await supabase
    .from('users')
    .update({ daily_goal_minutes: parsed.data.dailyGoalMinutes })
    .eq('id', req.userId);

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

export default router;
