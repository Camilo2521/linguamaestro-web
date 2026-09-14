'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { examApi } from '@/lib/api/exam';
import type { EvalEvent } from '@/types/domain.types';

interface ProcessingStreamProps {
  attemptId: string;
  onComplete: (events: EvalEvent[]) => void;
  onError: (error: string) => void;
}

const STEP_LABELS: Record<string, string> = {
  transcribing: 'Transcribiendo audio...',
  analyzing_fluency: 'Analizando fluidez...',
  analyzing_pronunciation: 'Evaluando pronunciación...',
  analyzing_grammar: 'Revisando gramática...',
  analyzing_vocabulary: 'Evaluando vocabulario...',
  analyzing_coherence: 'Analizando coherencia...',
  generating_plan: 'Generando plan de mejora...',
  finalizing: 'Finalizando evaluación...',
};

export function ProcessingStream({ attemptId, onComplete, onError }: ProcessingStreamProps) {
  const [events, setEvents] = useState<EvalEvent[]>([]);
  const [currentStep, setCurrentStep] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  // onmessage is assigned once inside the effect below, so it closes over
  // `events` as of the first render — reading state directly here always
  // returned only the most recent event. Track the running list in a ref too.
  const eventsRef = useRef<EvalEvent[]>([]);

  useEffect(() => {
    const es = new EventSource(examApi.evaluateStreamUrl(attemptId));
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: EvalEvent = JSON.parse(e.data);
        eventsRef.current = [...eventsRef.current, event];
        setEvents(eventsRef.current);

        if (event.type === 'step') setCurrentStep(event.step ?? '');
        if (event.type === 'complete') {
          es.close();
          onComplete(eventsRef.current);
        }
        if (event.type === 'error') {
          es.close();
          onError(event.message ?? 'Error desconocido');
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      onError('Error de conexión con el servidor');
    };

    return () => es.close();
  }, [attemptId]);

  const label = STEP_LABELS[currentStep] ?? 'Procesando...';

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" strokeWidth="4" stroke="var(--color-bg-overlay)" />
            <circle
              cx="40" cy="40" r="36" fill="none" strokeWidth="4"
              stroke="var(--color-accent-primary)"
              strokeDasharray="226"
              strokeDashoffset="56"
              strokeLinecap="round"
              className="animate-[dash_1.5s_ease-in-out_infinite]"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl">🧠</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          {label}
        </motion.p>
      </AnimatePresence>

      <div className="space-y-1.5 max-w-xs mx-auto">
        {Object.keys(STEP_LABELS).map((step) => {
          const done = events.some((e) => e.type === 'step' && e.step === step);
          const active = currentStep === step;
          return (
            <div
              key={step}
              className={`flex items-center gap-2 text-xs transition-all ${
                done ? 'text-emerald-400' : active ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]'
              }`}
            >
              <span className="shrink-0">{done ? '✓' : active ? '⟳' : '○'}</span>
              {STEP_LABELS[step]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
