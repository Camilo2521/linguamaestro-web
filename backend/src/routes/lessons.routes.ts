import { Router } from 'express';
import { z } from 'zod';
import { getUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { getNextLevel } from '../utils/levels.js';

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

  // Completing a lesson introduces vocabulary into the learner's SRS deck —
  // without this, /srs/due would stay empty forever, since nothing else in
  // the app ever seeds srs_items. Safe to run on every completion
  // (including repeats): the upsert below ignores rows already seeded for
  // this enrollment+vocabulary pair.
  //
  // Prefer words explicitly tied to this lesson (vocabulary_reference.lesson_id)
  // — seeding the learner's whole level in one shot the moment they finish
  // lesson 1 of 8 would dump dozens of words they've never seen into their
  // review queue. Only fall back to the old level-wide seeding for content
  // that predates this column (lesson_id is null on every row).
  const { data: lessonMeta } = await supabase
    .from('lessons')
    .select('language_code, level')
    .eq('id', lessonId)
    .single();

  if (lessonMeta) {
    const { data: lessonVocab, error: lessonVocabError } = await supabase
      .from('vocabulary_reference')
      .select('id')
      .eq('lesson_id', lessonId);

    let vocabulary = lessonVocab;
    let vocabError = lessonVocabError;

    if (!vocabError && (!lessonVocab || lessonVocab.length === 0)) {
      ({ data: vocabulary, error: vocabError } = await supabase
        .from('vocabulary_reference')
        .select('id')
        .eq('language_code', lessonMeta.language_code)
        .eq('level', lessonMeta.level)
        .is('lesson_id', null));
    }

    if (vocabError) {
      console.error(`vocabulary_reference lookup failed for lesson ${lessonId}:`, vocabError.message);
    } else if (vocabulary && vocabulary.length > 0) {
      const srsRows = vocabulary.map((v) => ({
        enrollment_id: enrollmentId,
        lesson_id: lessonId,
        vocabulary_id: v.id,
        ease_factor: 2.5,
        interval_days: 1,
        repetitions: 0,
        next_review_at: new Date().toISOString(),
      }));
      const { error: seedError } = await supabase
        .from('srs_items')
        .upsert(srsRows, { onConflict: 'enrollment_id,vocabulary_id', ignoreDuplicates: true });
      if (seedError) console.error(`srs_items seed failed for lesson ${lessonId}:`, seedError.message);
    }
  }

  // Advancing current_level used to happen only on passing the (now
  // removed) certification exam — that was the single path that ever
  // changed it after onboarding. Without a replacement, a learner who
  // finishes every lesson at their level has nowhere to go: /learn would
  // keep showing the same completed list forever. Instead, finishing the
  // last remaining lesson at the enrollment's current level auto-advances
  // it to the next CEFR level — no gate, just content completion.
  let leveledUp: string | null = null;
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, language_code, current_level')
    .eq('id', enrollmentId)
    .eq('user_id', req.userId)
    .single();

  if (enrollment) {
    const nextLevel = getNextLevel(enrollment.current_level);
    if (nextLevel) {
      const { data: levelLessons } = await supabase
        .from('lessons')
        .select('id')
        .eq('language_code', enrollment.language_code)
        .eq('level', enrollment.current_level);
      const levelLessonIds = (levelLessons ?? []).map((l) => l.id);

      if (levelLessonIds.length > 0) {
        const { data: completedRows } = await supabase
          .from('lesson_progress')
          .select('lesson_id')
          .eq('enrollment_id', enrollmentId)
          .eq('completed', true)
          .in('lesson_id', levelLessonIds);

        if ((completedRows ?? []).length >= levelLessonIds.length) {
          const { error: levelUpError } = await supabase
            .from('enrollments')
            .update({ current_level: nextLevel })
            .eq('id', enrollmentId);
          if (levelUpError) {
            console.error(`level-up failed for enrollment ${enrollmentId}:`, levelUpError.message);
          } else {
            leveledUp = nextLevel;
          }
        }
      }
    }
  }

  return res.json({ success: true, data: { xpEarned, leveledUp } });
});

export default router;
