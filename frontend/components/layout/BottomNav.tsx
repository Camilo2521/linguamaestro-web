'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, Dumbbell, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { href: '/learn', icon: BookOpen, label: 'Lecciones' },
  { href: '/practice', icon: Dumbbell, label: 'Práctica' },
  { href: '/progress', icon: BarChart2, label: 'Progreso' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--color-bg-card)] border-t border-[var(--color-border-default)] safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-2 rounded-[var(--radius-lg)] transition-all duration-150',
                active ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)]',
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
