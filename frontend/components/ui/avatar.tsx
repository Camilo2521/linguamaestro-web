import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils/cn';

const sizeClasses = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function Avatar({ className, size = 'md', ...props }: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({ className, ...props }: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full font-semibold',
        'bg-[var(--color-accent-primary)]/20 text-[var(--color-accent-primary)]',
        className,
      )}
      {...props}
    />
  );
}

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function UserAvatar({ src, name, size = 'md', className }: UserAvatarProps) {
  const initials = name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?';

  return (
    <Avatar size={size} className={className}>
      {src && <AvatarImage src={src} alt={name ?? 'Avatar'} />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
