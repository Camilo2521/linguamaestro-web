import { Router } from 'express';
import { z } from 'zod';
import { getUserClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const enrollmentSchema = z.object({ languageCode: z.enum(['en', 'fr', 'pt', 'es', 'ja', 'zh']) });

router.post('/enrollment', async (req, res) => {
  const parsed = enrollmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Idioma inválido' });

  const supabase = getUserClient(req.accessToken!);
  const { data, error } = await supabase
    .from('enrollments')
    .insert({ user_id: req.userId, language_code: parsed.data.languageCode, current_level: 'A1', active: true })
    .select()
    .single();

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data });
});

const nativeLanguageSchema = z.object({ nativeLanguage: z.string().min(2).max(10) });

router.patch('/native-language', async (req, res) => {
  const parsed = nativeLanguageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Idioma inválido' });

  const supabase = getUserClient(req.accessToken!);
  const { error } = await supabase
    .from('users')
    .update({ native_language: parsed.data.nativeLanguage })
    .eq('id', req.userId);

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

const diagnosticSchema = z.object({
  enrollmentId: z.string().uuid(),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE']),
});

router.patch('/diagnostic', async (req, res) => {
  const parsed = diagnosticSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Datos inválidos' });

  const supabase = getUserClient(req.accessToken!);
  const { error } = await supabase
    .from('enrollments')
    .update({ current_level: parsed.data.level, diagnostic_completed: true })
    .eq('id', parsed.data.enrollmentId)
    .eq('user_id', req.userId);

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

const completeSchema = z.object({
  dailyGoalMinutes: z.number().int().min(15).max(180),
  activeDays: z.array(z.number().int().min(0).max(6)).min(1),
});

router.post('/complete', async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Datos inválidos' });

  const supabase = getUserClient(req.accessToken!);

  // Guard: onboarding_completed unlocks the whole app, but every protected
  // page also requires an active enrollment — setting this flag without one
  // would trap the account in a redirect loop between dashboard and onboarding.
  const { count } = await supabase
    .from('enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.userId)
    .eq('active', true);
  if (!count) {
    return res.status(409).json({ success: false, error: 'Primero elige un idioma para aprender.', code: 'NO_ENROLLMENT' });
  }

  const { error } = await supabase
    .from('users')
    .update({
      daily_goal_minutes: parsed.data.dailyGoalMinutes,
      active_days: parsed.data.activeDays,
      onboarding_completed: true,
    })
    .eq('id', req.userId);

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

export default router;
