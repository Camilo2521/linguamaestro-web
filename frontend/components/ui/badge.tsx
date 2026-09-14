import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import type { CEFRLevel } from '@/types/domain.types';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'gold' | 'outline' | 'level';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  level?: CEFRLevel;
  size?: 'sm' | 'md';
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)]',
  primary: 'bg-[var(--color-accent-primary)]/15 text-[var(--color-accent-primary)] border border-[var(--color-accent-primary)]/30',
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  danger: 'bg-[var(--color-danger)]/15 text-red-400 border border-[var(--color-danger)]/30',
  gold: 'bg-[var(--color-accent-gold)]/15 text-[var(--color-accent-gold)] border border-[var(--color-accent-gold)]/30',
  outline: 'bg-transparent text-[var(--color-text-primary)] border border-[var(--color-border-strong)]',
  level: '',
};

const LEVEL_STYLES: Record<CEFRLevel, string> = {
  A1: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  A2: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  B1: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  B2: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  C1: 'bg-pink-500/15 text-pink-400 border border-pink-500/30',
  C2: 'bg-red-500/15 text-red-400 border border-red-500/30',
  NATIVE: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
};

export function Badge({ className, variant = 'default', level, size = 'md', children, ...props }: BadgeProps) {
  const levelStyle = variant === 'level' && level ? LEVEL_STYLES[level] : '';

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        variant === 'level' ? levelStyle : variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
