'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { MultipleChoice } from '@/components/learning/MultipleChoice';
import { FillBlank } from '@/components/learning/FillBlank';
import { FlashCard } from '@/components/learning/FlashCard';
import { lessonsApi } from '@/lib/api/lessons';
import { useToast } from '@/stores/ui.store';

interface Exercise {
  id: string;
  type: 'multiple_choice' | 'fill_blank' | 'flashcard' | 'speaking' | 'reorder';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation?: string;
  order_index: number;
}

interface Props {
  lesson: { id: string; title: string };
  exercises: Exercise[];
  enrollmentId: string;
}

type ExerciseResult = { exerciseId: string; correct: boolean; timeMs: number };

export function LessonEngine({ lesson, exercises, enrollmentId }: Props) {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [startTime] = useState(() => Date.now());
  const [exerciseStart, setExerciseStart] = useState(() => Date.now());
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentExercise = exercises[currentIdx] ?? null;
  const progress = exercises.length > 0 ? ((currentIdx) / exercises.length) * 100 : 0;

  const handleAnswer = useCallback((_answer: string, correct: boolean) => {
    const exercise = exercises[currentIdx];
    if (!exercise) return;
    const timeMs = Date.now() - exerciseStart;
    setResults((prev) => [...prev, { exerciseId: exercise.id, correct, timeMs }]);
    setLastCorrect(correct);
    setShowFeedback(true);
  }, [exercises, currentIdx, exerciseStart]);

  async function handleNext() {
    setShowFeedback(false);
    setLastCorrect(null);

    if (currentIdx + 1 >= exercises.length) {
      await finishLesson();
    } else {
      setCurrentIdx((i) => i + 1);
      setExerciseStart(Date.now());
    }
  }

  async function finishLesson() {
    setIsSaving(true);
    try {
      const allResults = results;
      const correctCount = allResults.filter((r) => r.correct).length;
      const score = exercises.length > 0 ? correctCount / exercises.length : 1;
      const timeSpentSeconds = Math.round((Date.now() - startTime) / 1000);

      const result = await lessonsApi.complete(lesson.id, enrollmentId, score, timeSpentSeconds);
      success(`¡Lección completada! +${result.data.xpEarned} XP`);
      setIsComplete(true);
    } catch {
      toastError('Error al guardar el progreso');
    } finally {
      setIsSaving(false);
    }
  }

  if (isComplete) {
    const correct = results.filter((r) => r.correct).length;
    const total = results.length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 100;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-6 py-12"
      >
        <div className="text-6xl">{pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '📚'}</div>
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {pct >= 80 ? '¡Excelente!' : pct >= 60 ? '¡Bien hecho!' : 'Sigue practicando'}
          </h2>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {correct} de {total} respuestas correctas · {pct}%
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => router.push('/learn')}>
            Volver a lecciones
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            Ir al dashboard
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!currentExercise) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X size={20} />
        </button>
        <Progress value={progress} className="flex-1" size="sm" animated />
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">
          {currentIdx + 1}/{exercises.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentExercise.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
        >
          {currentExercise.type === 'multiple_choice' && (
            <MultipleChoice
              question={currentExercise.question}
              options={currentExercise.options ?? []}
              correctAnswer={currentExercise.correct_answer}
              explanation={currentExercise.explanation}
              onAnswer={handleAnswer}
              showFeedback={showFeedback}
            />
          )}
          {currentExercise.type === 'fill_blank' && (
            <FillBlank
              question={currentExercise.question}
              correctAnswer={currentExercise.correct_answer}
              explanation={currentExercise.explanation}
              onAnswer={handleAnswer}
              showFeedback={showFeedback}
            />
          )}
          {currentExercise.type === 'flashcard' && (
            <FlashCard
              front={currentExercise.question}
              back={currentExercise.correct_answer}
              onAnswer={handleAnswer}
              showFeedback={showFeedback}
            />
          )}
          {(currentExercise.type === 'speaking' || currentExercise.type === 'reorder') && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] leading-relaxed">
                {currentExercise.question}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Este tipo de ejercicio no está disponible todavía en esta versión.
              </p>
              {!showFeedback && (
                <Button onClick={() => handleAnswer(currentExercise.correct_answer, true)}>
                  Continuar →
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {showFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-[var(--radius-xl)] border ${
            lastCorrect
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <p className={`font-semibold text-sm mb-1 ${lastCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {lastCorrect ? '✓ ¡Correcto!' : '✗ Incorrecto'}
          </p>
          {!lastCorrect && currentExercise.explanation && (
            <p className="text-xs text-[var(--color-text-secondary)]">{currentExercise.explanation}</p>
          )}
          <Button
            className="w-full mt-3"
            size="sm"
            variant={lastCorrect ? 'primary' : 'secondary'}
            onClick={handleNext}
            loading={isSaving}
          >
            {currentIdx + 1 >= exercises.length ? 'Finalizar lección' : 'Siguiente →'}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
