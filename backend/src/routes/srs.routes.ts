import { Router } from 'express';
import { z } from 'zod';
import { getUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { computeScheduleISO } from '../utils/srs-schedule.js';

const router = Router();
router.use(requireAuth);

const dueQuerySchema = z.object({
  enrollmentId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/due', async (req, res) => {
  const parsed = dueQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'enrollmentId requerido' });
  const { enrollmentId, limit } = parsed.data;

  const supabase = getUserClient(req.accessToken!);
  const { data, error } = await supabase
    .from('srs_items')
    .select('*, vocabulary_reference(word, translation, example_sentence, audio_url, image_url, pronunciation)')
    .eq('enrollment_id', enrollmentId)
    .lte('next_review_at', new Date().toISOString())
    .order('next_review_at', { ascending: true })
    .limit(limit);

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data: data ?? [] });
});

const reviewSchema = z.object({
  quality: z.number().int().min(0).max(5),
  enrollmentId: z.string().uuid(),
});

router.post('/:itemId/review', async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Datos inválidos' });

  const supabase = getUserClient(req.accessToken!);
  const { data: item } = await supabase
    .from('srs_items')
    .select('ease_factor, interval_days, repetitions, total_reviews')
    .eq('id', req.params.itemId)
    .single();

  if (!item) return res.status(404).json({ success: false, error: 'Item no encontrado' });

  const { newEase, newInterval, newRepetitions, nextReview } = computeScheduleISO(
    parsed.data.quality as 0 | 1 | 2 | 3 | 4 | 5,
    item.ease_factor,
    item.interval_days,
    item.repetitions,
  );

  const { error } = await supabase
    .from('srs_items')
    .update({
      ease_factor: newEase,
      interval_days: newInterval,
      repetitions: newRepetitions,
      next_review_at: nextReview,
      last_reviewed_at: new Date().toISOString(),
      total_reviews: item.total_reviews + 1,
    })
    .eq('id', req.params.itemId);

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

const seedSchema = z.object({
  enrollmentId: z.string().uuid(),
  lessonId: z.string().uuid(),
  vocabularyIds: z.array(z.string().uuid()),
});

router.post('/seed', async (req, res) => {
  const parsed = seedSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Datos inválidos' });

  const supabase = getUserClient(req.accessToken!);
  const items = parsed.data.vocabularyIds.map((vocabId) => ({
    enrollment_id: parsed.data.enrollmentId,
    lesson_id: parsed.data.lessonId,
    vocabulary_id: vocabId,
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 0,
    next_review_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('srs_items')
    .upsert(items, { onConflict: 'enrollment_id,vocabulary_id', ignoreDuplicates: true });

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

export default router;
