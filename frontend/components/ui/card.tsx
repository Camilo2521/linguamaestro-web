import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'bordered';
  hover?: boolean;
}

export function Card({ className, variant = 'default', hover = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-xl)] transition-all duration-200',
        {
          'bg-[var(--color-bg-card)] border border-[var(--color-border-default)]': variant === 'default',
          'bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-[var(--shadow-card)]': variant === 'elevated',
          'bg-[var(--color-bg-overlay)] backdrop-blur-sm border border-[var(--color-border-default)]/50': variant === 'glass',
          'bg-transparent border-2 border-[var(--color-border-strong)]': variant === 'bordered',
          'hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-card)] cursor-pointer': hover,
        },
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 p-6', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-lg font-semibold text-[var(--color-text-primary)] leading-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm text-[var(--color-text-secondary)]', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-6 pb-6', className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center px-6 pb-6 pt-0', className)}
      {...props}
    />
  );
}
