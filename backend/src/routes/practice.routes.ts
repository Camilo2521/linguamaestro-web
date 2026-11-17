import { Router } from 'express';
import { z } from 'zod';
import { getUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { MAX_DAILY_MINUTES, checkDailyLimit, getTodayTotalMinutes } from '../utils/activity-limits.js';
import { levenshteinSimilarity } from '../utils/text-similarity.js';

const router = Router();
router.use(requireAuth);

// Practice prompts are short, discrete bursts (2-5 min), not open-ended
// study sessions — the generic POST /activity route's 15-minute session
// floor (designed for lesson/study-time tracking) doesn't fit this shape at
// all, which is exactly why the old timer-based Practice page could never
// actually save a session that followed its own "2 minutes is enough" UI.
// This route logs completions directly, with a floor sized for a single
// prompt instead.
const MIN_PRACTICE_SECONDS = 20;
// multiple_choice/fill_blank are answered in seconds, not minutes — gating
// them on the same 20s floor as a speaking/shadowing burst would make an
// honestly-answered quick question fail to save. These two (and
// pronunciation) are graded on correctness instead of effort-time.
const MIN_PRONUNCIATION_SECONDS = 2;
const FILL_BLANK_THRESHOLD = 0.85; // matches FillBlank.tsx/Reorder.tsx on the frontend
const PRONUNCIATION_THRESHOLD = 0.7; // more lenient — browser speech recognition is noisier than typed text
const PRACTICE_XP_PER_MINUTE = 12;

const MODE_TO_ACTIVITY_TYPE = {
  speaking: 'speaking',
  shadowing: 'listening',
  debate: 'speaking',
  writing: 'writing',
  multiple_choice: 'speaking',
  fill_blank: 'writing',
  pronunciation: 'speaking',
} as const;

const PRACTICE_MODES = [
  'speaking', 'shadowing', 'debate', 'writing',
  'multiple_choice', 'fill_blank', 'pronunciation',
] as const;

const listQuerySchema = z.object({
  languageCode: z.enum(['en', 'fr', 'pt', 'es', 'ja', 'zh']),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE']),
  mode: z.enum(PRACTICE_MODES),
});

router.get('/', async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Parámetros inválidos' });
  const { languageCode, level, mode } = parsed.data;

  const supabase = getUserClient(req.accessToken!);
  const { data, error } = await supabase
    .from('practice_prompts')
    .select('*')
    .eq('language_code', languageCode)
    .eq('level', level)
    .eq('mode', mode)
    .order('order_index', { ascending: true });

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data: data ?? [] });
});

const completeSchema = z.object({
  enrollmentId: z.string().uuid(),
  durationSeconds: z.number().int().min(0),
  wordCount: z.number().int().min(0).optional(),
  // multiple_choice / fill_blank: the learner's answer, graded against the
  // prompt's own correct_answer (never trust a client-reported "correct").
  answer: z.string().optional(),
  // pronunciation: the browser speech-recognition transcript, graded
  // against the prompt's reference_text the same way.
  transcript: z.string().optional(),
});

router.post('/:promptId/complete', async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Datos inválidos' });
  const { enrollmentId, durationSeconds, wordCount, answer, transcript } = parsed.data;

  const supabase = getUserClient(req.accessToken!);

  const [{ data: prompt }, { data: enrollment }] = await Promise.all([
    supabase.from('practice_prompts')
      .select('id, mode, language_code, level, target_words, correct_answer, reference_text')
      .eq('id', req.params.promptId)
      .single(),
    supabase.from('enrollments').select('id').eq('id', enrollmentId).eq('user_id', req.userId).single(),
  ]);

  if (!prompt) return res.status(404).json({ success: false, error: 'Ejercicio no encontrado' });
  if (!enrollment) return res.status(404).json({ success: false, error: 'Enrollment no encontrado' });

  // `correct` is null for modes with no notion of right/wrong (speaking,
  // shadowing, debate) — only set for the three auto-graded modes, and only
  // a correct answer earns XP for those. Everything is still logged either
  // way so a wrong answer doesn't erase the learner's effort from their
  // streak/daily progress, it just doesn't pay out.
  let correct: boolean | null = null;

  if (prompt.mode === 'writing') {
    const minWords = Math.max(5, Math.round((prompt.target_words ?? 30) * 0.5));
    if ((wordCount ?? 0) < minWords) {
      return res.status(400).json({
        success: false,
        error: `Escribe al menos ${minWords} palabras para completar el ejercicio.`,
      });
    }
  } else if (prompt.mode === 'multiple_choice') {
    if (!answer) return res.status(400).json({ success: false, error: 'Selecciona una respuesta.' });
    correct = answer === prompt.correct_answer;
  } else if (prompt.mode === 'fill_blank') {
    if (!answer?.trim()) return res.status(400).json({ success: false, error: 'Escribe una respuesta.' });
    correct = levenshteinSimilarity(answer.trim().toLowerCase(), (prompt.correct_answer ?? '').trim().toLowerCase()) >= FILL_BLANK_THRESHOLD;
  } else if (prompt.mode === 'pronunciation') {
    if (!transcript?.trim()) return res.status(400).json({ success: false, error: 'No se detectó ningún audio. Intenta de nuevo.' });
    if (durationSeconds < MIN_PRONUNCIATION_SECONDS) {
      return res.status(400).json({ success: false, error: `Practica al menos ${MIN_PRONUNCIATION_SECONDS} segundos.` });
    }
    correct = levenshteinSimilarity(transcript.trim().toLowerCase(), (prompt.reference_text ?? '').trim().toLowerCase()) >= PRONUNCIATION_THRESHOLD;
  } else if (durationSeconds < MIN_PRACTICE_SECONDS) {
    return res.status(400).json({
      success: false,
      error: `Practica al menos ${MIN_PRACTICE_SECONDS} segundos para completar el ejercicio.`,
    });
  }

  const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

  const totalToday = await getTodayTotalMinutes(supabase, req.userId!);
  const limitCheck = checkDailyLimit(totalToday, durationMinutes);
  if (!limitCheck.allowed) {
    return res.status(429).json({ success: false, blocked: true, error: `Límite diario alcanzado (${MAX_DAILY_MINUTES} min)` });
  }

  const activityType = MODE_TO_ACTIVITY_TYPE[prompt.mode as keyof typeof MODE_TO_ACTIVITY_TYPE];
  const xpEarned = correct === false ? 0 : durationMinutes * PRACTICE_XP_PER_MINUTE;

  const { error } = await supabase.from('activity_logs').insert({
    user_id: req.userId,
    enrollment_id: enrollmentId,
    activity_type: activityType,
    duration_minutes: durationMinutes,
    xp_earned: xpEarned,
    metadata: {
      prompt_id: prompt.id,
      mode: prompt.mode,
      language_code: prompt.language_code,
      level: prompt.level,
      word_count: wordCount ?? null,
      correct,
    },
  });
  if (error) return res.status(400).json({ success: false, error: error.message });

  const { error: streakError } = await supabase.rpc('update_streak', { p_user_id: req.userId });
  if (streakError) console.error(`update_streak failed for user ${req.userId}:`, streakError.message);

  return res.json({ success: true, data: { xpEarned, correct } });
});

export default router;
