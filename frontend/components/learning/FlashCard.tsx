'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface FlashCardProps {
  front: string;
  back: string;
  showFeedback: boolean;
  onAnswer: (answer: string, correct: boolean) => void;
  audioUrl?: string;
}

export function FlashCard({ front, back, showFeedback, onAnswer, audioUrl }: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [rated, setRated] = useState(false);

  function handleFlip() {
    if (!isFlipped) setIsFlipped(true);
  }

  function handleRate(knew: boolean) {
    if (rated) return;
    setRated(true);
    onAnswer(back, knew);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-text-muted)] text-center">
        {isFlipped ? 'Traducción' : 'Toca para ver la traducción'}
      </p>

      <button
        type="button"
        aria-label={isFlipped ? 'Tarjeta volteada' : 'Voltear tarjeta para ver la traducción'}
        className="relative h-48 w-full cursor-pointer select-none text-left"
        style={{ perspective: 1200 }}
        onClick={handleFlip}
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
          className="absolute inset-0"
        >
          <div
            className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-2xl)] border-2 border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-xl font-semibold text-[var(--color-text-primary)] text-center">{front}</p>
          </div>

          <div
            className="absolute inset-0 flex items-center justify-center rounded-[var(--radius-2xl)] border-2 border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/8 p-6"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-xl font-semibold text-[var(--color-accent-primary)] text-center">{back}</p>
          </div>
        </motion.div>
      </button>

      {isFlipped && !rated && !showFeedback && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <button
            onClick={() => handleRate(false)}
            className="flex-1 py-3 rounded-[var(--radius-xl)] border-2 border-red-500/40 bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/15 transition-colors"
          >
            ✗ No lo sabía
          </button>
          <button
            onClick={() => handleRate(true)}
            className="flex-1 py-3 rounded-[var(--radius-xl)] border-2 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/15 transition-colors"
          >
            ✓ Lo sabía
          </button>
        </motion.div>
      )}
    </div>
  );
}
