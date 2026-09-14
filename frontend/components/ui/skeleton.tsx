import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({ className, variant = 'rectangular', width, height, lines, style, ...props }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={cn('flex flex-col gap-2', className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'skeleton rounded-[var(--radius-sm)]',
              i === lines - 1 && 'w-3/4',
            )}
            style={{ height: height ?? '1rem', width: i === lines - 1 ? '75%' : width }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'skeleton',
        variant === 'circular' ? 'rounded-full' : 'rounded-[var(--radius-md)]',
        className,
      )}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

export function CardSkeleton({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6 space-y-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton height={14} width="60%" />
          <Skeleton height={12} width="40%" />
        </div>
      </div>
      <Skeleton height={12} lines={lines} />
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-5 space-y-3">
      <Skeleton height={12} width="50%" />
      <Skeleton height={32} width="70%" />
      <Skeleton height={8} />
    </div>
  );
}
