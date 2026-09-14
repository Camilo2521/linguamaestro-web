import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getUserClient, serviceClient } from '../lib/supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { examAttemptLimiter } from '../middleware/rateLimit.js';
import { computeEligibility } from '../utils/exam-eligibility.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  // Shallow check only — `mimetype` is client-reported and trivially
  // spoofable, this just rejects obviously-wrong uploads early rather than
  // storing them and feeding them to Whisper.
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/'));
  },
});

// Enrollment + embedded exam_attempts history, for the exam landing page.
router.get('/overview', async (req, res) => {
  const supabase = getUserClient(req.accessToken!);

  // Not .single(): a user can have more than one active enrollment
  // (multi-language support).
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('*, exam_attempts(id, created_at, passed, overall_score)')
    .eq('user_id', req.userId)
    .eq('active', true)
    .order('created_at', { ascending: false, referencedTable: 'exam_attempts' });

  const enrollment = enrollments?.[0] ?? null;
  if (!enrollment) return res.status(404).json({ success: false, error: 'No hay inscripción activa' });

  return res.json({ success: true, data: enrollment });
});

// Shared by GET /eligibility and the POST /attempts gate below — eligibility
// must be enforced wherever an attempt can be created, not just wherever
// it's displayed.
async function loadEligibility(supabase: ReturnType<typeof getUserClient>, enrollmentId: string, userId: string) {
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('current_level, total_study_hours, started_at, exam_attempts_count')
    .eq('id', enrollmentId)
    .eq('user_id', userId)
    .single();
  if (!enrollment) return null;

  const { data: lastAttempt } = await supabase
    .from('exam_attempts')
    .select('created_at, passed')
    .eq('enrollment_id', enrollmentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const result = computeEligibility({
    currentLevel: enrollment.current_level,
    hoursStudied: enrollment.total_study_hours ?? 0,
    startedAt: enrollment.started_at,
    lastAttemptDate: lastAttempt?.created_at ?? null,
  });

  return { ...result, lastAttemptDate: lastAttempt?.created_at ?? null };
}

router.get('/eligibility', async (req, res) => {
  const parsedId = z.string().uuid().safeParse(req.query.enrollmentId);
  if (!parsedId.success) return res.status(400).json({ success: false, error: 'enrollmentId requerido' });

  const supabase = getUserClient(req.accessToken!);
  const eligibility = await loadEligibility(supabase, parsedId.data, req.userId!);
  if (!eligibility) return res.status(404).json({ success: false, error: 'Enrollment no encontrado' });

  return res.json({ success: true, data: eligibility });
});

const createAttemptSchema = z.object({ enrollmentId: z.string().uuid() });

router.post('/attempts', examAttemptLimiter, async (req, res) => {
  const parsed = createAttemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: 'Datos inválidos' });

  const supabase = getUserClient(req.accessToken!);

  // Re-check eligibility (and, implicitly, that the enrollment belongs to
  // this user) server-side — GET /eligibility is informational only, so
  // without this a caller could skip straight to creating/evaluating an
  // attempt regardless of hours studied, months enrolled, or cooldown.
  const eligibility = await loadEligibility(supabase, parsed.data.enrollmentId, req.userId!);
  if (!eligibility) return res.status(404).json({ success: false, error: 'Enrollment no encontrado' });
  if (!eligibility.eligible) {
    return res.status(403).json({ success: false, error: 'No cumples los requisitos para el examen', reasons: eligibility.reasons });
  }

  const { data, error } = await supabase
    .from('exam_attempts')
    .insert({ enrollment_id: parsed.data.enrollmentId, user_id: req.userId, status: 'recording' })
    .select('id')
    .single();

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true, data: { attemptId: data.id } });
});

// The frontend has no direct Supabase access, so the recorded video is
// uploaded here and forwarded into Storage with the service client, after
// verifying the caller owns the attempt.
router.post('/attempts/:attemptId/video', upload.single('video'), async (req, res) => {
  const file = req.file;
  const durationSeconds = Number(req.body.durationSeconds);
  if (!file || !Number.isFinite(durationSeconds)) {
    return res.status(400).json({ success: false, error: 'Video o duración faltante' });
  }

  const supabase = getUserClient(req.accessToken!);
  const { data: attempt } = await supabase
    .from('exam_attempts')
    .select('id, user_id')
    .eq('id', req.params.attemptId)
    .eq('user_id', req.userId)
    .single();
  if (!attempt) return res.status(404).json({ success: false, error: 'Intento no encontrado' });

  const ext = file.mimetype.includes('mp4') ? 'mp4' : 'webm';
  const path = `${req.userId}/${req.params.attemptId}.${ext}`;

  const { error: uploadErr } = await serviceClient.storage
    .from('exam-videos')
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
  if (uploadErr) return res.status(400).json({ success: false, error: uploadErr.message });

  const { error } = await supabase
    .from('exam_attempts')
    .update({ video_url: path, duration_seconds: Math.floor(durationSeconds), status: 'processing', submitted_at: new Date().toISOString() })
    .eq('id', req.params.attemptId)
    .eq('user_id', req.userId);

  if (error) return res.status(400).json({ success: false, error: error.message });
  return res.json({ success: true });
});

router.get('/attempts/:attemptId', async (req, res) => {
  const supabase = getUserClient(req.accessToken!);
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*, enrollments(language_code, current_level)')
    .eq('id', req.params.attemptId)
    .eq('user_id', req.userId)
    .single();

  if (error || !data) return res.status(404).json({ success: false, error: 'Intento no encontrado' });
  return res.json({ success: true, data });
});

function sseMessage(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function getMinScore(level: string): number {
  const scores: Record<string, number> = { A1: 0.70, A2: 0.72, B1: 0.75, B2: 0.78, C1: 0.82, C2: 0.88, NATIVE: 0.92 };
  return scores[level] ?? 0.75;
}

// SSE stream: transcribes the recording, grades it with Claude, and persists
// the result. Ownership of attemptId is verified against the caller's own
// session before anything is read or billed — this route uses the
// service-role client below (needs a signed storage URL + writes the grade),
// which bypasses RLS entirely.
router.get('/attempts/:attemptId/evaluate', async (req, res) => {
  const attemptId = req.params.attemptId;
  const userId = req.userId!;

  // Without these, a client disconnecting mid-stream (closed tab, lost
  // connection) would leave `res.write()` calls below targeting a destroyed
  // socket — Node's default behavior for an unhandled `error` event on the
  // response is to crash the whole process, taking down every other
  // in-flight request. `aborted` also lets the long-running step loop
  // short-circuit instead of doing pointless work for a client that's gone.
  let aborted = false;
  req.on('close', () => { aborted = true; });
  res.on('error', () => { aborted = true; });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (data: object) => {
    if (aborted || res.writableEnded) return;
    res.write(sseMessage(data));
  };

  try {
    const { data: attempt } = await serviceClient
      .from('exam_attempts')
      .select('*, enrollments(language_code, current_level)')
      .eq('id', attemptId)
      .single();

    if (!attempt) {
      send({ type: 'error', message: 'Intento no encontrado' });
      return res.end();
    }
    if (attempt.user_id !== userId) {
      send({ type: 'error', message: 'No autorizado' });
      return res.end();
    }
    if (attempt.status === 'completed') {
      // Already graded — avoid re-billing Whisper/Anthropic on repeat requests.
      send({ type: 'complete', data: attempt.ai_feedback ?? {} });
      return res.end();
    }

    send({ type: 'step', step: 'transcribing' });

    let transcript = '';
    if (attempt.video_url) {
      const { data: signedData } = await serviceClient.storage
        .from('exam-videos')
        .createSignedUrl(attempt.video_url, 600);
      const signedUrl = signedData?.signedUrl ?? null;

      if (signedUrl) {
        const videoResp = await fetch(signedUrl);
        if (videoResp.ok) {
          const videoBlob = await videoResp.blob();
          const fd = new FormData();
          fd.append('model', 'whisper-1');
          fd.append('response_format', 'text');
          fd.append('file', videoBlob, `exam-recording.${attempt.video_url.split('.').pop() ?? 'webm'}`);

          const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
            body: fd,
          });
          if (whisperResp.ok) transcript = await whisperResp.text();
        }
      }
    }

    const steps = ['analyzing_fluency', 'analyzing_pronunciation', 'analyzing_grammar', 'analyzing_vocabulary', 'analyzing_coherence', 'generating_plan'];
    for (const step of steps) {
      if (aborted) return; // client is gone — don't bother billing Claude below
      send({ type: 'step', step });
      await new Promise((r) => setTimeout(r, 800));
    }
    if (aborted) return;

    send({ type: 'step', step: 'finalizing' });

    const enrollment = (attempt as any).enrollments;
    const evalPrompt = `You are an expert CEFR language examiner evaluating an oral exam for level ${enrollment.current_level} in ${enrollment.language_code}.

Transcript of student's response:
"""
${transcript || '[No transcript available — evaluate based on expected performance for this level]'}
"""

Evaluate the student on exactly these 5 dimensions (0.0 to 1.0 each):
1. fluency - naturalness and speed of speech
2. pronunciation - clarity and comprehensibility
3. grammar - correct use of structures
4. vocabulary - range and precision
5. coherence - organization and logical flow

The minimum passing score for ${enrollment.current_level} is ${getMinScore(enrollment.current_level)}.

Respond ONLY with valid JSON in this exact shape:
{
  "fluency": 0.0-1.0,
  "pronunciation": 0.0-1.0,
  "grammar": 0.0-1.0,
  "vocabulary": 0.0-1.0,
  "coherence": 0.0-1.0,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "detected_errors": [{"type": "...", "original": "...", "correction": "...", "explanation": "..."}],
  "improvement_plan": [{"week": 1, "task": "...", "resources": ["..."], "estimated_minutes": 30}],
  "feedback_summary": "..."
}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const aiResponse = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [{ role: 'user', content: evalPrompt }],
    });

    const rawText = aiResponse.content[0]?.type === 'text' ? aiResponse.content[0].text : '{}';
    let feedback: Record<string, unknown>;
    try {
      feedback = JSON.parse(rawText.replace(/```json\n?|\n?```/g, ''));
    } catch {
      feedback = { fluency: 0.5, pronunciation: 0.5, grammar: 0.5, vocabulary: 0.5, coherence: 0.5 };
    }

    // Don't trust a model-reported overall_score/passed (this prompt no
    // longer even asks for them) — recompute from the 5 scored dimensions
    // and this level's real passing threshold, so an inconsistent response
    // can't silently mis-advance a user's CEFR level.
    const clamp01 = (n: unknown) => Math.max(0, Math.min(1, typeof n === 'number' && Number.isFinite(n) ? n : 0.5));
    const dims = {
      fluency: clamp01(feedback.fluency),
      pronunciation: clamp01(feedback.pronunciation),
      grammar: clamp01(feedback.grammar),
      vocabulary: clamp01(feedback.vocabulary),
      coherence: clamp01(feedback.coherence),
    };
    const overallScore = (dims.fluency + dims.pronunciation + dims.grammar + dims.vocabulary + dims.coherence) / 5;
    const minScore = getMinScore(enrollment.current_level);
    const passed = overallScore >= minScore;
    feedback = { ...feedback, ...dims, overall_score: overallScore, passed };

    await serviceClient.from('exam_attempts').update({
      status: 'completed',
      transcript,
      overall_score: overallScore,
      passed,
      ai_feedback: feedback,
      evaluated_at: new Date().toISOString(),
    }).eq('id', attemptId);

    if (passed) {
      const nextLevels: Record<string, string> = { A1: 'A2', A2: 'B1', B1: 'B2', B2: 'C1', C1: 'C2', C2: 'NATIVE' };
      const next = nextLevels[enrollment.current_level];
      if (next) {
        await serviceClient.from('enrollments').update({ current_level: next }).eq('id', attempt.enrollment_id);
      }
    }

    send({ type: 'complete', data: feedback });
  } catch (err) {
    send({ type: 'error', message: err instanceof Error ? err.message : 'Error desconocido' });
  }

  res.end();
});

export default router;
