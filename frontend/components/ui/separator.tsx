import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '@/lib/utils/cn';

interface SeparatorProps extends React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root> {
  label?: string;
}

export function Separator({ className, orientation = 'horizontal', decorative = true, label, ...props }: SeparatorProps) {
  if (label) {
    return (
      <div className="flex items-center gap-3">
        <SeparatorPrimitive.Root
          decorative
          orientation="horizontal"
          className="flex-1 h-px bg-[var(--color-border-default)]"
        />
        <span className="text-xs text-[var(--color-text-muted)] shrink-0">{label}</span>
        <SeparatorPrimitive.Root
          decorative
          orientation="horizontal"
          className="flex-1 h-px bg-[var(--color-border-default)]"
        />
      </div>
    );
  }

  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-[var(--color-border-default)]',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}
