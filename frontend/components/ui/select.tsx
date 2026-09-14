'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  label?: string;
  error?: string;
}

export function SelectTrigger({ className, children, label, error, ...props }: SelectTriggerProps) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">{label}</label>
      )}
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-lg)]',
          'border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]',
          'px-4 text-sm text-[var(--color-text-primary)] transition-all duration-150',
          'focus:outline-none focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'data-[placeholder]:text-[var(--color-text-muted)]',
          error && 'border-[var(--color-danger)]',
          className,
        )}
        {...props}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)] shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

export function SelectContent({ className, children, position = 'popper', ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'relative z-50 min-w-[8rem] overflow-hidden rounded-[var(--radius-xl)]',
          'border border-[var(--color-border-default)] bg-[var(--color-bg-card)] shadow-[var(--shadow-modal)]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-6 text-[var(--color-text-muted)]">
          <ChevronUp className="h-4 w-4" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-6 text-[var(--color-text-muted)]">
          <ChevronDown className="h-4 w-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({ className, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      className={cn('px-2 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]', className)}
      {...props}
    />
  );
}

export function SelectItem({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-[var(--radius-md)]',
        'py-2 pl-8 pr-3 text-sm text-[var(--color-text-primary)] outline-none',
        'focus:bg-[var(--color-bg-elevated)] focus:text-[var(--color-text-primary)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'transition-colors',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4 text-[var(--color-accent-primary)]" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({ className, ...props }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      className={cn('my-1 h-px bg-[var(--color-border-default)]', className)}
      {...props}
    />
  );
}
