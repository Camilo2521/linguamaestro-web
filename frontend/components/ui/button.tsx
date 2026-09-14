'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[var(--color-accent-primary)] text-white hover:brightness-110 active:brightness-95 ' +
    '[box-shadow:var(--shadow-cta)] disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] ' +
    'border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)] ' +
    'hover:bg-[var(--color-bg-overlay)] disabled:opacity-50',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] ' +
    'hover:bg-[var(--color-bg-elevated)] disabled:opacity-50',
  danger:
    'bg-[var(--color-danger)] text-white hover:brightness-110 active:brightness-95 ' +
    'disabled:opacity-50',
  gold:
    'bg-[var(--color-accent-gold)] text-[#0C0E1A] font-semibold hover:brightness-110 ' +
    '[box-shadow:var(--shadow-glow-gold)] disabled:opacity-50',
  outline:
    'bg-transparent border-2 border-[var(--color-accent-primary)] text-[var(--color-accent-primary)] ' +
    'hover:bg-[var(--color-accent-primary)] hover:text-white disabled:opacity-50',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-[var(--radius-md)]',
  md: 'h-10 px-5 text-sm rounded-[var(--radius-lg)]',
  lg: 'h-12 px-7 text-base rounded-[var(--radius-xl)]',
  icon: 'h-9 w-9 rounded-[var(--radius-lg)] p-0',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      asChild = false,
      icon,
      iconPosition = 'left',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <motion.div
        whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
        transition={{ duration: 0.1 }}
        className="inline-flex"
      >
        <Comp
          ref={ref}
          disabled={disabled || loading}
          className={cn(
            'inline-flex items-center justify-center gap-2 font-semibold',
            'transition-all duration-150 select-none',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent-primary)] focus-visible:outline-offset-2',
            variantClasses[variant],
            sizeClasses[size],
            className,
          )}
          {...props}
        >
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              {icon && iconPosition === 'left' && icon}
              {children}
              {icon && iconPosition === 'right' && icon}
            </>
          )}
        </Comp>
      </motion.div>
    );
  },
);

Button.displayName = 'Button';

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
