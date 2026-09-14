'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useSRSSession } from '@/hooks/useSRSSession';
import { FlashCard } from '@/components/learning/FlashCard';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { X } from 'lucide-react';

export default function ReviewPage() {
  const router = useRouter();
  const { currentCard, progress, isLoading, isFinished, flipCard, handleRate } = useSRSSession();

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <Skeleton height={48} />
        <Skeleton height={200} />
      </div>
    );
  }

  if (isFinished || !currentCard) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg mx-auto text-center py-16 space-y-4"
      >
        <div className="text-5xl">🎊</div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
          {progress.total === 0 ? '¡Todo repasado!' : `¡Sesión completada! ${Math.round(progress.accuracy * 100)}% correcto`}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {progress.total === 0 ? 'No hay tarjetas pendientes hoy.' : `Repasaste ${progress.done} tarjetas`}
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <Button variant="secondary" onClick={() => router.push('/learn')}>Volver</Button>
          <Button onClick={() => router.push('/dashboard')}>Dashboard</Button>
        </div>
      </motion.div>
    );
  }

  const vocab = (currentCard as any).vocabulary_reference;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X size={20} />
        </button>
        <Progress value={(progress.done / progress.total) * 100} className="flex-1" size="sm" />
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">
          {progress.done}/{progress.total}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentCard.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <FlashCard
            front={vocab?.word ?? currentCard.id}
            back={vocab?.translation ?? ''}
            showFeedback={false}
            onAnswer={(_, knew) => handleRate(knew ? 4 : 1)}
          />
        </motion.div>
      </AnimatePresence>

      {vocab?.example_sentence && (
        <p className="text-xs text-[var(--color-text-muted)] text-center italic px-4">
          "{vocab.example_sentence}"
        </p>
      )}
    </div>
  );
}
