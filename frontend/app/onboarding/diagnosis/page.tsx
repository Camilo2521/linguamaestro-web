'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { onboardingApi } from '@/lib/api/onboarding';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/stores/ui.store';
import { cn } from '@/lib/utils/cn';
import type { CEFRLevel } from '@/types/domain.types';

interface Question {
  id: string;
  level: CEFRLevel;
  text: string;
  options: string[];
  correct: number;
}

const QUESTIONS: Question[] = [
  { id: 'q1', level: 'A1', text: 'What is the correct greeting for the morning?', options: ['Good night', 'Good morning', 'Good evening', 'Goodbye'], correct: 1 },
  { id: 'q2', level: 'A1', text: 'Choose the correct verb: "She ___ a student."', options: ['am', 'is', 'are', 'be'], correct: 1 },
  { id: 'q3', level: 'A2', text: 'Which sentence is correct?', options: ['I have went there', 'I has gone there', 'I went there yesterday', 'I go there yesterday'], correct: 2 },
  { id: 'q4', level: 'A2', text: '"Although it was raining, ___."', options: ['we go out', 'we went out', 'we goes out', 'we goed out'], correct: 1 },
  { id: 'q5', level: 'B1', text: 'What does "ubiquitous" mean?', options: ['Very rare', 'Found everywhere', 'Extremely large', 'Completely silent'], correct: 1 },
  { id: 'q6', level: 'B1', text: 'Correct conditional: "If I ___ rich, I would travel the world."', options: ['am', 'was', 'were', 'be'], correct: 2 },
  { id: 'q7', level: 'B2', text: 'Best word for "thing that helps you see better"?', options: ['Spectacles', 'Binoculars', 'Sunglasses', 'Lenses'], correct: 0 },
  { id: 'q8', level: 'B2', text: '"The project was completed despite ___."', options: ['to face many obstacles', 'facing many obstacles', 'faced many obstacles', 'the face of obstacles'], correct: 1 },
  { id: 'q9', level: 'C1', text: 'The subjunctive mood is primarily used for:', options: ['Describing habits', 'Expressing wishes/hypotheticals', 'Listing facts', 'Giving orders'], correct: 1 },
  { id: 'q10', level: 'C1', text: '"The legislation was enacted notwithstanding ___."', options: ['of the opposition', 'the opposition', 'to oppose it', 'opposition it'], correct: 1 },
  { id: 'q11', level: 'C2', text: '"His perspicacious remarks ___."', options: ['confused everyone', 'revealed keen insight', 'were poorly timed', 'lacked substance'], correct: 1 },
  { id: 'q12', level: 'C2', text: 'Which contains a dangling modifier?', options: ['Running quickly, she caught the bus.', 'Having finished the report, the meeting began.', 'Exhausted after the race, he sat down.', 'Confused by it, she asked for help.'], correct: 1 },
];

const LEVEL_ORDER: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function computeLevel(answers: Record<string, boolean>): CEFRLevel {
  let result: CEFRLevel = 'A1';
  for (const level of LEVEL_ORDER) {
    const levelQs = QUESTIONS.filter((q) => q.level === level);
    const correct = levelQs.filter((q) => answers[q.id]).length;
    if (correct / levelQs.length >= 0.5) result = level;
    else break;
  }
  return result;
}

type Phase = 'intro' | 'test' | 'result';

export default function DiagnosisPage() {
  const router = useRouter();
  const { error: toastError, warning: toastWarning } = useToast();
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [assignedLevel, setAssignedLevel] = useState<CEFRLevel>('A1');
  const [isPending, setIsPending] = useState(false);

  const currentQ = QUESTIONS[currentIdx]!;
  const progress = Math.round((currentIdx / QUESTIONS.length) * 100);

  function handleAnswer(optionIdx: number) {
    if (selectedOption !== null) return;
    setSelectedOption(optionIdx);
    const correct = optionIdx === currentQ.correct;
    const newAnswers = { ...answers, [currentQ.id]: correct };

    setTimeout(() => {
      if (currentIdx < QUESTIONS.length - 1) {
        setAnswers(newAnswers);
        setCurrentIdx((i) => i + 1);
        setSelectedOption(null);
      } else {
        const level = computeLevel(newAnswers);
        setAnswers(newAnswers);
        setAssignedLevel(level);
        setPhase('result');
      }
    }, 700);
  }

  async function handleConfirm() {
    setIsPending(true);
    try {
      const { data } = await authApi.me();
      const enrollment = data.enrollments[0];
      if (!enrollment) {
        toastError('No encontramos tu inscripción. Vuelve a elegir un idioma.');
        router.push('/onboarding/language');
        return;
      }

      await onboardingApi.setDiagnosticLevel(enrollment.id, assignedLevel);
      router.push('/onboarding/schedule');
    } catch (err) {
      // The placement level can only be set once per enrollment (e.g. the
      // learner came back to this step with the browser's back button) —
      // the first result stands, so just carry on with onboarding.
      if (err instanceof ApiError && err.code === 'DIAGNOSTIC_ALREADY_COMPLETED') {
        toastWarning(err.message);
        router.push('/onboarding/schedule');
        return;
      }
      toastError(err instanceof ApiError ? err.message : 'No se pudo guardar tu nivel');
    } finally {
      setIsPending(false);
    }
  }

  if (phase === 'intro') {
    return (
      <div className="py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Test de diagnóstico</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            12 preguntas adaptativas para encontrar tu nivel actual. Solo 5 minutos.
          </p>
        </motion.div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '⏱️', label: '5 min', sub: 'aproximado' },
            { icon: '🎯', label: '12', sub: 'preguntas' },
            { icon: '📊', label: 'A1–C2', sub: 'niveles CEFR' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 p-3 rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] border border-[var(--color-border-default)]">
              <span className="text-2xl">{s.icon}</span>
              <span className="font-bold text-[var(--color-text-primary)] text-sm">{s.label}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">{s.sub}</span>
            </div>
          ))}
        </div>
        <Button size="lg" className="w-full" onClick={() => setPhase('test')}>
          Comenzar test →
        </Button>
        <button
          onClick={() => router.push('/onboarding/schedule')}
          className="w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          Saltar — empezar en A1
        </button>
      </div>
    );
  }

  if (phase === 'test') {
    return (
      <div className="py-8 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>Pregunta {currentIdx + 1} de {QUESTIONS.length}</span>
            <Badge variant="level" level={currentQ.level}>{currentQ.level}</Badge>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-bg-overlay)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-[var(--color-accent-primary)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-base font-medium text-[var(--color-text-primary)] leading-relaxed">
              {currentQ.text}
            </p>
            <div className="space-y-2">
              {currentQ.options.map((opt, i) => {
                const isSelected = selectedOption === i;
                const isCorrect = i === currentQ.correct;
                const showFeedback = selectedOption !== null;
                return (
                  <button
                    key={i}
                    onClick={() => handleAnswer(i)}
                    disabled={selectedOption !== null}
                    className={cn(
                      'w-full text-left p-4 rounded-[var(--radius-xl)] border transition-all duration-200 text-sm font-medium',
                      !showFeedback && 'border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/5',
                      showFeedback && isCorrect && 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
                      showFeedback && isSelected && !isCorrect && 'border-red-500 bg-red-500/10 text-red-400',
                      showFeedback && !isSelected && !isCorrect && 'border-[var(--color-border-default)] opacity-40',
                    )}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  const correctCount = Object.values(answers).filter(Boolean).length;

  return (
    <div className="py-8 space-y-6 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
        <div className="text-5xl">🎯</div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Tu nivel es</h2>
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full border-2 border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10">
          <span className="text-3xl font-bold text-[var(--color-accent-primary)]">{assignedLevel}</span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {correctCount} de {QUESTIONS.length} respuestas correctas
        </p>
      </motion.div>
      <Button size="lg" className="w-full" onClick={handleConfirm} loading={isPending}>
        Comenzar en {assignedLevel} →
      </Button>
    </div>
  );
}
