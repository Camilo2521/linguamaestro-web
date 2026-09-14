'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  onIconClick?: () => void;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, iconPosition = 'left', onIconClick, id, type = 'text', ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-secondary)]"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {icon && iconPosition === 'left' && (
            <span
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]',
                onIconClick && 'cursor-pointer hover:text-[var(--color-text-primary)] transition-colors',
              )}
              onClick={onIconClick}
            >
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              'w-full rounded-[var(--radius-lg)] border border-[var(--color-border-default)]',
              'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]',
              'placeholder:text-[var(--color-text-muted)] text-sm',
              'h-10 px-4 transition-all duration-150',
              'focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/30',
              icon && iconPosition === 'left' && 'pl-10',
              icon && iconPosition === 'right' && 'pr-10',
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />

          {icon && iconPosition === 'right' && (
            <span
              className={cn(
                'absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]',
                onIconClick && 'cursor-pointer hover:text-[var(--color-text-primary)] transition-colors',
              )}
              onClick={onIconClick}
            >
              {icon}
            </span>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--color-danger)]">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--color-text-muted)]">
            {hint}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-[var(--radius-lg)] border border-[var(--color-border-default)]',
            'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]',
            'placeholder:text-[var(--color-text-muted)] text-sm',
            'px-4 py-3 min-h-[100px] resize-y transition-all duration-150',
            'focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[var(--color-danger)]',
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />

        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        {!error && hint && <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
