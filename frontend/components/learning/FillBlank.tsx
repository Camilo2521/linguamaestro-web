'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface FillBlankProps {
  question: string;
  correctAnswer: string;
  explanation?: string;
  showFeedback: boolean;
  onAnswer: (answer: string, correct: boolean) => void;
}

function levenshteinSimilarity(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return 1 - dp[m]![n]! / Math.max(m, n);
}

export function FillBlank({ question, correctAnswer, showFeedback, onAnswer }: FillBlankProps) {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const parts = question.split('___');
  const hasBlanks = parts.length > 1;

  function handleSubmit() {
    if (!value.trim() || submitted) return;
    setSubmitted(true);
    const similarity = levenshteinSimilarity(
      value.trim().toLowerCase(),
      correctAnswer.toLowerCase(),
    );
    onAnswer(value.trim(), similarity >= 0.85);
  }

  return (
    <div className="space-y-6">
      <div className="text-lg font-semibold text-[var(--color-text-primary)] leading-relaxed">
        {hasBlanks ? (
          <span>
            {parts[0]}
            <span className={cn(
              'inline-block mx-1 px-3 py-0.5 rounded-[var(--radius-md)] border-b-2 min-w-[120px] text-center',
              submitted
                ? levenshteinSimilarity(value.toLowerCase(), correctAnswer.toLowerCase()) >= 0.85
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-red-500 text-red-400'
                : 'border-[var(--color-accent-primary)] text-[var(--color-accent-primary)]',
            )}>
              {submitted ? value || '___' : value || '___'}
            </span>
            {parts[1]}
          </span>
        ) : (
          <p>{question}</p>
        )}
      </div>

      {showFeedback && submitted && levenshteinSimilarity(value.toLowerCase(), correctAnswer.toLowerCase()) < 0.85 && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Respuesta correcta: <span className="text-emerald-400 font-semibold">{correctAnswer}</span>
        </p>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          disabled={submitted}
          placeholder="Escribe tu respuesta..."
          className={cn(
            'flex-1 h-11 px-4 rounded-[var(--radius-lg)] border bg-[var(--color-bg-elevated)]',
            'text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]/50',
            'transition-all duration-150',
            !submitted && 'border-[var(--color-border-default)]',
            submitted && levenshteinSimilarity(value.toLowerCase(), correctAnswer.toLowerCase()) >= 0.85 && 'border-emerald-500',
            submitted && levenshteinSimilarity(value.toLowerCase(), correctAnswer.toLowerCase()) < 0.85 && 'border-red-500',
          )}
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || submitted}
          className="px-5 h-11 rounded-[var(--radius-lg)] bg-[var(--color-accent-primary)] text-white text-sm font-semibold disabled:opacity-40 hover:brightness-110 transition-all"
        >
          OK
        </button>
      </div>
    </div>
  );
}
