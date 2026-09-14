'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { examApi } from '@/lib/api/exam';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { AudioMeter } from '@/components/exam/AudioMeter';
import { ExamTimer } from '@/components/exam/ExamTimer';
import { Button } from '@/components/ui/button';
import { useActiveEnrollment } from '@/stores/session.store';
import { useToast } from '@/stores/ui.store';
import { LEVELS } from '@/lib/utils/levels';

const EXAM_PROMPTS: Record<string, string[]> = {
  A1: ['Habla sobre tu rutina diaria. ¿Qué haces por la mañana?', 'Describe tu familia. ¿Cuántas personas son?'],
  A2: ['Cuéntame sobre tus vacaciones favoritas.', '¿Qué te gusta hacer en tu tiempo libre?'],
  B1: ['Habla sobre un problema social importante en tu país.', 'Describe tus planes para el futuro.'],
  B2: ['¿Cuáles son los pros y contras del trabajo remoto?', 'Habla sobre el impacto de la tecnología en la educación.'],
  C1: ['Analiza las causas y consecuencias del cambio climático.', 'Discute el papel de la inteligencia artificial en la sociedad moderna.'],
  C2: ['Elabora un argumento matizado sobre la globalización y la pérdida de identidad cultural.', 'Discute las implicaciones éticas de la ingeniería genética.'],
  NATIVE: ['Habla sobre un tema complejo de tu elección con precisión y matiz.'],
};

function RecordPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const enrollment = useActiveEnrollment();
  const { error: toastError } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prompt, setPrompt] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [phase, setPhase] = useState<'countdown' | 'recording' | 'done'>('countdown');
  const [countdown, setCountdown] = useState(3);

  const level = enrollment?.current_level ?? 'A1';
  const maxSeconds = (LEVELS[level]?.exam_duration_minutes ?? 15) * 60;

  useEffect(() => {
    const prompts = EXAM_PROMPTS[level] ?? EXAM_PROMPTS['A1']!;
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)]!);
  }, [level]);

  const { state, stream, durationSeconds, start, stop } = useMediaRecorder({
    maxDurationMs: maxSeconds * 1000,
    onStop: async (blob, durationMs) => {
      if (!attemptId) return;
      setIsUploading(true);
      setPhase('done');

      try {
        const result = await examApi.uploadVideo(attemptId, blob, Math.floor(durationMs / 1000), blob.type);
        if (!result.success) {
          toastError(result.error ?? 'No se pudo enviar el examen.');
          return;
        }
        router.push(`/exam/processing/${attemptId}`);
      } catch {
        toastError('No se pudo subir el video del examen. Intenta de nuevo.');
      } finally {
        setIsUploading(false);
      }
    },
  });

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) {
      setPhase('recording');
      start({ video: { facingMode: 'user' }, audio: true });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, phase, start]);

  if (!attemptId) {
    router.push('/exam');
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="relative rounded-[var(--radius-2xl)] overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover mirror"
          style={{ transform: 'scaleX(-1)' }}
        />

        {phase === 'countdown' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <motion.span
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0 }}
              className="text-8xl font-black text-white"
            >
              {countdown || '¡Ya!'}
            </motion.span>
          </div>
        )}

        {phase === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/90 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-bold text-white">REC</span>
          </div>
        )}

        {phase === 'recording' && (
          <div className="absolute top-3 right-3">
            <ExamTimer seconds={durationSeconds} maxSeconds={maxSeconds} />
          </div>
        )}

        {stream && phase === 'recording' && (
          <div className="absolute bottom-4 inset-x-0 flex justify-center">
            <AudioMeter stream={stream} barCount={20} height={32} />
          </div>
        )}
      </div>

      <div className="p-4 rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] border border-[var(--color-border-default)]">
        <p className="text-xs text-[var(--color-text-muted)] mb-1">Tema del examen</p>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{prompt}</p>
      </div>

      <div className="flex gap-3">
        {phase === 'recording' && (
          <Button variant="danger" className="flex-1" onClick={() => stop()} loading={isUploading}>
            ⏹ Finalizar grabación
          </Button>
        )}
        {phase === 'done' && (
          <Button className="flex-1" loading={isUploading}>
            {isUploading ? 'Subiendo video...' : 'Procesando...'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">Cargando...</div>}>
      <RecordPageInner />
    </Suspense>
  );
}
