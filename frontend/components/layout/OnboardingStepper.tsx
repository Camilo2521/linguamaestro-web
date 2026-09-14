'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Step {
  label: string;
  description?: string;
}

interface OnboardingStepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function OnboardingStepper({ steps, currentStep, className }: OnboardingStepperProps) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;

        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'relative flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300',
                  done && 'bg-[var(--color-accent-primary)] border-[var(--color-accent-primary)]',
                  active && 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10',
                  !done && !active && 'border-[var(--color-border-default)] bg-transparent',
                )}
              >
                {done ? (
                  <Check className="h-4 w-4 text-white" />
                ) : (
                  <span
                    className={cn(
                      'text-xs font-bold',
                      active ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]',
                    )}
                  >
                    {i + 1}
                  </span>
                )}
                {active && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-[var(--color-accent-primary)]"
                    animate={{ scale: [1, 1.3, 1], opacity: [1, 0, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium hidden sm:block',
                  active ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]',
                )}
              >
                {step.label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-12 sm:w-20 mx-1 transition-all duration-500',
                  done ? 'bg-[var(--color-accent-primary)]' : 'bg-[var(--color-border-default)]',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
