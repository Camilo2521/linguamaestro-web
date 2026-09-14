'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { examApi } from '@/lib/api/exam';
import { useActiveEnrollment } from '@/stores/session.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

const REQUIREMENTS = [
  { icon: '📷', label: 'Cámara frontal habilitada' },
  { icon: '🎙️', label: 'Micrófono sin ruido de fondo' },
  { icon: '💡', label: 'Buena iluminación en tu rostro' },
  { icon: '🔇', label: 'Lugar tranquilo, sin interrupciones' },
  { icon: '⏱️', label: 'Tiempo disponible: 15–40 minutos' },
];

const RUBRIC = [
  { dimension: 'Fluidez', pct: 20, desc: 'Velocidad y naturalidad del habla' },
  { dimension: 'Pronunciación', pct: 20, desc: 'Claridad y acento comprensible' },
  { dimension: 'Gramática', pct: 20, desc: 'Uso correcto de estructuras' },
  { dimension: 'Vocabulario', pct: 20, desc: 'Rango y precisión léxica' },
  { dimension: 'Coherencia', pct: 20, desc: 'Organización y lógica del discurso' },
];

export default function ExamPreparePage() {
  const router = useRouter();
  const enrollment = useActiveEnrollment();
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [isPending, setIsPending] = useState(false);

  function toggleCheck(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const allChecked = checked.size === REQUIREMENTS.length;

  async function handleStart() {
    if (!enrollment || !allChecked) return;
    setIsPending(true);
    try {
      const result = await examApi.createAttempt(enrollment.id);
      router.push(`/exam/record?attemptId=${result.data.attemptId}`);
    } catch {
      setIsPending(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Preparación del examen</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Revisa los requisitos antes de comenzar tu grabación
        </p>
      </motion.div>

      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">Rúbrica de evaluación</p>
          {RUBRIC.map((r) => (
            <div key={r.dimension} className="flex items-center justify-between py-1.5">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{r.dimension}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{r.desc}</p>
              </div>
              <span className="text-sm font-bold text-[var(--color-accent-primary)]">{r.pct}%</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">Confirma los requisitos</p>
          {REQUIREMENTS.map((req, i) => (
            <button
              key={i}
              onClick={() => toggleCheck(i)}
              className="flex items-center gap-3 w-full p-3 rounded-[var(--radius-lg)] hover:bg-[var(--color-bg-elevated)] transition-colors text-left"
            >
              <div className={`flex items-center justify-center w-5 h-5 rounded rounded-[var(--radius-sm)] border-2 transition-all ${
                checked.has(i)
                  ? 'bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)]'
                  : 'border-[var(--color-border-strong)]'
              }`}>
                {checked.has(i) && <CheckCircle className="h-3 w-3 text-white" />}
              </div>
              <span className="text-lg">{req.icon}</span>
              <span className="text-sm text-[var(--color-text-primary)]">{req.label}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => router.back()}>
          Volver
        </Button>
        <Button
          className="flex-1"
          disabled={!allChecked}
          loading={isPending}
          onClick={handleStart}
          variant="gold"
        >
          🎤 Iniciar grabación
        </Button>
      </div>
    </div>
  );
}
