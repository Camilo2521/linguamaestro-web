import { Router } from 'express';
import { z } from 'zod';
import { getUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// List lessons for the caller's enrollment (language + current level),
// merged with this enrollment's progress per lesson.
const enrollmentIdQuerySchema = z.string().uuid();

router.get('/', async (req, res) => {
  const parsedId = enrollmentIdQuerySchema.safeParse(req.query.enrollmentId);
  if (!parsedId.success) return res.status(400).json({ success: false, error: 'enrollmentId requerido' });
  const enrollmentId = parsedId.data;

  const supabase = getUserClient(req.accessToken!);

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('language_code, current_level')
    .eq('id', enrollmentId)
    .eq('user_id', req.userId)
    .single();
  if (!enrollment) return res.status(404).json({ success: false, error: 'Enrollment no encontrado' });

  const [{ data: lessons }, { data: progress }] = await Promise.all([
    supabase
      .from('lessons')
      .select('*')
      .eq('language_code', enrollment.language_code)
      .eq('level', enrollment.current_level)
      .order('order_index', { ascending: true }),
    supabase.from('lesson_progress').select('lesson_id, completed, score').eq('enrollment_id', enrollmentId),
  ]);

  return res.json({ success: true, data: { lessons: lessons ?? [], progress: progress ?? [] } });
});

// Lesson detail + exercises, scoped to an enrollment the caller owns.
router.get('/:lessonId', async (req, res) => {
  const parsedId = enrollmentIdQuerySchema.safeParse(req.query.enrollmentId);
  if (!parsedId.success) return res.status(400).json({ success: false, error: 'enrollmentId requerido' });
  const enrollmentId = parsedId.data;

  const supabase = getUserClient(req.accessToken!);

  const [{ data: lesson }, { data: enrollment }] = await Promise.all([
    supabase.from('lessons').select('*, exercises(*)').eq('id', req.params.lessonId).single(),
    supabase.from('enrollments').select('id, current_level').eq('id', enrollmentId).eq('user_id', req.userId).single(),
  ]);

  if (!lesson) return res.status(404).json({ success: false, error: 'Lección no encontrada' });
  if (!enrollment) return res.status(404).json({ success: false, error: 'Enrollment no encontrado' });

  const exercises = (lesson.exercises ?? []).sort((a: any, b: any) => a.order_index - b.order_index);
  return res.json({ success: true, data: { lesson, exercises, enrollmentId: enrollment.id } });
});

const completeSchema = z.object({
  enrollmentId: z.string().uuid(),
  score: z.number(),
  timeSpentSeconds: z.number().int().min(0),
});

router.post('/:lessonId/complete', async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Datos inválidos' });

  const { enrollmentId, timeSpentSeconds } = parsed.data;
  const lessonId = req.params.lessonId;
  const supabase = getUserClient(req.accessToken!);

  const { data: existing } = await supabase
    .from('lesson_progress')
    .select('id, completed')
    .eq('enrollment_id', enrollmentId)
    .eq('lesson_id', lessonId)
    .single();

  // score is client-supplied — clamp it so a tampered request can't mint
  // arbitrary XP via increment_xp.
  const clampedScore = Math.max(0, Math.min(1, parsed.data.score));
  const xpEarned = existing?.completed ? 0 : Math.round(clampedScore * 100);

  const { error } = await supabase
    .from('lesson_progress')
    .upsert({
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      completed: true,
      score: clampedScore,
      time_spent_seconds: timeSpentSeconds,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'enrollment_id,lesson_id' });

  if (error) return res.status(400).json({ success: false, error: error.message });

  if (xpEarned > 0) {
    const { error: xpError } = await supabase.rpc('increment_xp', { p_enrollment_id: enrollmentId, p_xp: xpEarned });
    if (xpError) console.error(`increment_xp failed for enrollment ${enrollmentId}:`, xpError.message);
  }

  const { error: logError } = await supabase.from('activity_logs').insert({
    user_id: req.userId,
    enrollment_id: enrollmentId,
    activity_type: 'lesson',
    duration_minutes: Math.ceil(timeSpentSeconds / 60),
    xp_earned: xpEarned,
    metadata: { lesson_id: lessonId, score: clampedScore },
  });
  if (logError) console.error(`activity_logs insert failed for lesson ${lessonId}:`, logError.message);

  return res.json({ success: true, data: { xpEarned } });
});

export default router;
