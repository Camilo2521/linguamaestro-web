'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface MultipleChoiceProps {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  showFeedback: boolean;
  onAnswer: (answer: string, correct: boolean) => void;
}

export function MultipleChoice({ question, options, correctAnswer, showFeedback, onAnswer }: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleSelect(opt: string) {
    if (selected !== null || showFeedback) return;
    setSelected(opt);
    onAnswer(opt, opt === correctAnswer);
  }

  if (options.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] leading-relaxed">
          {question}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Este ejercicio no tiene opciones configuradas.
        </p>
        <button
          type="button"
          onClick={() => onAnswer('', false)}
          className="text-sm font-semibold text-[var(--color-accent-primary)] hover:underline"
        >
          Continuar →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] leading-relaxed">
        {question}
      </h2>

      <div className="space-y-2.5">
        {options.map((opt, i) => {
          const isSelected = selected === opt;
          const isCorrect = opt === correctAnswer;
          const showResult = showFeedback && (isSelected || isCorrect);

          return (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => handleSelect(opt)}
              disabled={selected !== null}
              className={cn(
                'w-full text-left p-4 rounded-[var(--radius-xl)] border-2 transition-all duration-200',
                'text-sm font-medium',
                !selected && 'border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/5',
                showResult && isCorrect && 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
                showResult && isSelected && !isCorrect && 'border-red-500 bg-red-500/10 text-red-300',
                !showResult && selected && !isSelected && 'border-[var(--color-border-default)] opacity-40',
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0',
                  !selected && 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
                  showResult && isCorrect && 'bg-emerald-500 text-white',
                  showResult && isSelected && !isCorrect && 'bg-red-500 text-white',
                )}>
                  {showResult && isCorrect ? '✓' : showResult && isSelected ? '✗' : String.fromCharCode(65 + i)}
                </span>
                {opt}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
