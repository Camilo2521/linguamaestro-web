'use client';

import { cn } from '@/lib/utils/cn';

interface ExamTimerProps {
  seconds: number;
  maxSeconds: number;
  className?: string;
}

export function ExamTimer({ seconds, maxSeconds, className }: ExamTimerProps) {
  const remaining = maxSeconds - seconds;
  const pct = (seconds / maxSeconds) * 100;
  const isWarning = remaining <= 60;
  const isDanger = remaining <= 15;

  const mm = Math.floor(remaining / 60).toString().padStart(2, '0');
  const ss = (remaining % 60).toString().padStart(2, '0');

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <span
        className={cn(
          'text-2xl font-mono font-bold tabular-nums transition-colors',
          isDanger && 'text-red-400 animate-pulse',
          isWarning && !isDanger && 'text-amber-400',
          !isWarning && 'text-[var(--color-text-primary)]',
        )}
      >
        {mm}:{ss}
      </span>
      <div className="w-24 h-1 rounded-full bg-[var(--color-bg-overlay)] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000',
            isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-[var(--color-accent-primary)]',
          )}
          style={{ width: `${100 - pct}%` }}
        />
      </div>
    </div>
  );
}
