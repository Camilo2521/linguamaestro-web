'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { levenshteinSimilarity } from '@/lib/utils/text-similarity';

interface ReorderProps {
  question: string;
  correctAnswer: string;
  explanation?: string;
  showFeedback: boolean;
  onAnswer: (answer: string, correct: boolean) => void;
}

interface Chip {
  word: string;
  key: number;
}

function shuffledChips(sentence: string): Chip[] {
  const chips = sentence.trim().split(/\s+/).map((word, key) => ({ word, key }));
  for (let i = chips.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chips[i], chips[j]] = [chips[j]!, chips[i]!];
  }
  // A shuffle landing on the original order gives the answer away for free.
  if (chips.length > 1 && chips.every((c, i) => c.key === i)) {
    [chips[0], chips[1]] = [chips[1]!, chips[0]!];
  }
  return chips;
}

export function Reorder({ question, correctAnswer, explanation, showFeedback, onAnswer }: ReorderProps) {
  const [bank, setBank] = useState<Chip[]>(() => shuffledChips(correctAnswer));
  const [picked, setPicked] = useState<Chip[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const total = useMemo(() => correctAnswer.trim().split(/\s+/).length, [correctAnswer]);
  const isComplete = picked.length === total;
  const assembled = picked.map((c) => c.word).join(' ');
  const isCorrect = isComplete && levenshteinSimilarity(assembled.toLowerCase(), correctAnswer.trim().toLowerCase()) >= 0.85;

  function pick(chip: Chip) {
    if (submitted) return;
    setBank((b) => b.filter((c) => c.key !== chip.key));
    setPicked((p) => [...p, chip]);
  }

  function unpick(chip: Chip) {
    if (submitted) return;
    setPicked((p) => p.filter((c) => c.key !== chip.key));
    setBank((b) => [...b, chip]);
  }

  function handleSubmit() {
    if (!isComplete || submitted) return;
    setSubmitted(true);
    onAnswer(assembled, isCorrect);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] leading-relaxed">
        {question}
      </h2>

      <div className={cn(
        'min-h-[64px] flex flex-wrap items-start gap-2 p-3 rounded-[var(--radius-xl)] border-2 border-dashed',
        submitted
          ? isCorrect ? 'border-emerald-500/50' : 'border-red-500/50'
          : 'border-[var(--color-border-default)]',
      )}>
        {picked.length === 0 && (
          <span className="text-sm text-[var(--color-text-muted)] py-2">Toca las palabras en el orden correcto…</span>
        )}
        {picked.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => unpick(chip)}
            disabled={submitted}
            className={cn(
              'px-3 py-2 rounded-[var(--radius-lg)] text-sm font-medium border-2 transition-colors',
              submitted
                ? isCorrect
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500 bg-red-500/10 text-red-300'
                : 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 text-[var(--color-text-primary)] hover:brightness-110',
            )}
          >
            {chip.word}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {bank.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => pick(chip)}
            disabled={submitted}
            className="px-3 py-2 rounded-[var(--radius-lg)] text-sm font-medium border-2 border-[var(--color-border-default)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/5 transition-all disabled:opacity-40"
          >
            {chip.word}
          </button>
        ))}
      </div>

      {showFeedback && submitted && !isCorrect && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Respuesta correcta: <span className="text-emerald-400 font-semibold">{correctAnswer}</span>
          {explanation && <span className="block mt-1 text-xs">{explanation}</span>}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isComplete || submitted}
        className="w-full h-11 rounded-[var(--radius-lg)] bg-[var(--color-accent-primary)] text-white text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition-all"
      >
        Comprobar
      </button>
    </div>
  );
}
