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

// Upper bound matches the 360-minute daily activity cap — a single lesson
// can't plausibly take longer, and an unbounded value would inflate
// activity_logs.duration_minutes (daily progress, dashboard).
const MAX_LESSON_SECONDS = 6 * 60 * 60;

const completeSchema = z.object({
  enrollmentId: z.string().uuid(),
  score: z.number(),
  timeSpentSeconds: z.number().int().min(0).max(MAX_LESSON_SECONDS),
});

const lessonIdSchema = z.string().uuid();

router.post('/:lessonId/complete', async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  const parsedLessonId = lessonIdSchema.safeParse(req.params.lessonId);
  if (!parsed.success || !parsedLessonId.success) {
    return res.status(400).json({ success: false, error: 'Datos inválidos' });
  }

  const { enrollmentId, timeSpentSeconds } = parsed.data;
  const lessonId = parsedLessonId.data;
  const supabase = getUserClient(req.accessToken!);

  const [{ data: enrollment }, { data: lessonMeta }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, language_code, current_level')
      .eq('id', enrollmentId)
      .eq('user_id', req.userId)
      .maybeSingle(),
    supabase.from('lessons').select('id, language_code, level').eq('id', lessonId).maybeSingle(),
  ]);

  if (!enrollment) return res.status(404).json({ success: false, error: 'Enrollment no encontrado' });
  if (!lessonMeta) return res.status(404).json({ success: false, error: 'Lección no encontrada' });

  // Only lessons from the enrollment's own language and current level can be
  // completed — the same set GET /lessons lists. Without this check, the
  // completion endpoint could be used to earn XP from any lesson in the
  // catalogue (other languages, other levels) that the UI never offers.
  if (lessonMeta.language_code !== enrollment.language_code || lessonMeta.level !== enrollment.current_level) {
    return res.status(409).json({
      success: false,
      error: 'Esta lección no pertenece a tu nivel actual.',
      code: 'LESSON_NOT_IN_CURRENT_LEVEL',
    });
  }

  // score is client-supplied — clamp it so a tampered request can't mint
  // arbitrary XP via increment_xp.
  const clampedScore = Math.max(0, Math.min(1, parsed.data.score));
  const progressFields = {
    completed: true,
    score: clampedScore,
    time_spent_seconds: timeSpentSeconds,
    completed_at: new Date().toISOString(),
  };

  // XP is only awarded to the request that actually flips this lesson to
  // completed. Each step below is a single atomic statement whose returned
  // rows say whether *this* request made the change, so two concurrent
  // completions of the same lesson can't both earn XP (a separate
  // read-then-write check could).
  //   1. INSERT ... ON CONFLICT DO NOTHING RETURNING — first ever attempt.
  //   2. UPDATE ... WHERE completed = false RETURNING — a row existed but
  //      wasn't completed yet.
  //   3. Otherwise it's a repeat: record the latest attempt, no XP.
  const { data: inserted, error: insertError } = await supabase
    .from('lesson_progress')
    .upsert(
      { enrollment_id: enrollmentId, lesson_id: lessonId, ...progressFields },
      { onConflict: 'enrollment_id,lesson_id', ignoreDuplicates: true },
    )
    .select('id');
  if (insertError) return res.status(400).json({ success: false, error: insertError.message });

  let firstCompletion = (inserted?.length ?? 0) > 0;

  if (!firstCompletion) {
    const { data: flipped, error: flipError } = await supabase
      .from('lesson_progress')
      .update(progressFields)
      .eq('enrollment_id', enrollmentId)
      .eq('lesson_id', lessonId)
      .eq('completed', false)
      .select('id');
    if (flipError) return res.status(400).json({ success: false, error: flipError.message });
    firstCompletion = (flipped?.length ?? 0) > 0;
  }

  if (!firstCompletion) {
    const { error: repeatError } = await supabase
      .from('lesson_progress')
      .update(progressFields)
      .eq('enrollment_id', enrollmentId)
      .eq('lesson_id', lessonId);
    if (repeatError) return res.status(400).json({ success: false, error: repeatError.message });
  }

  const xpEarned = firstCompletion ? Math.round(clampedScore * 100) : 0;

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
  {
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
  //
  // NATIVE is terminal: getNextLevel('NATIVE') is null, so nothing advances
  // past it. C2 → NATIVE is intentional (product decision).
  let leveledUp: string | null = null;
  {
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
          // Compare-and-set on current_level: only advances from the level
          // this request validated against, so concurrent completions can't
          // skip a level, and only the request that actually advanced it
          // reports leveledUp.
          const { data: advanced, error: levelUpError } = await supabase
            .from('enrollments')
            .update({ current_level: nextLevel })
            .eq('id', enrollmentId)
            .eq('user_id', req.userId)
            .eq('current_level', enrollment.current_level)
            .select('id');
          if (levelUpError) {
            console.error(`level-up failed for enrollment ${enrollmentId}:`, levelUpError.message);
          } else if ((advanced?.length ?? 0) > 0) {
            leveledUp = nextLevel;
          }
        }
      }
    }
  }

  return res.json({ success: true, data: { xpEarned, leveledUp } });
});

export default router;
