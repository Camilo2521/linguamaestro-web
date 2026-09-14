'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils/cn';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  animated?: boolean;
  showLabel?: boolean;
}

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function Progress({
  className,
  value = 0,
  color,
  size = 'md',
  animated = true,
  showLabel = false,
  ...props
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-[var(--color-text-secondary)]" />
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{clamped}%</span>
        </div>
      )}
      <ProgressPrimitive.Root
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-[var(--color-bg-overlay)]',
          sizeClasses[size],
          className,
        )}
        value={clamped}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full rounded-full',
            animated && 'transition-all duration-500 ease-out',
          )}
          style={{
            width: `${clamped}%`,
            background: color ?? 'var(--color-accent-primary)',
          }}
        />
      </ProgressPrimitive.Root>
    </div>
  );
}

interface MultiSegmentProgressProps {
  segments: Array<{ value: number; color: string; label?: string }>;
  total?: number;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function MultiSegmentProgress({ segments, total = 100, size = 'md', className }: MultiSegmentProgressProps) {
  return (
    <div className={cn('flex w-full gap-0.5 overflow-hidden rounded-full', sizeClasses[size], className)}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className="h-full transition-all duration-500 ease-out first:rounded-l-full last:rounded-r-full"
          style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }}
        />
      ))}
    </div>
  );
}
