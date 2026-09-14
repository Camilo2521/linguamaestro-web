'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, Dumbbell, GraduationCap,
  BarChart2, Settings, ChevronLeft, ChevronRight, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useUIStore, useToast } from '@/stores/ui.store';
import { useSessionStore } from '@/stores/session.store';
import { authApi } from '@/lib/api/auth';
import { UserAvatar } from '@/components/ui/avatar';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useActiveEnrollment } from '@/stores/session.store';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/learn', icon: BookOpen, label: 'Aprender' },
  { href: '/practice', icon: Dumbbell, label: 'Práctica' },
  { href: '/exam', icon: GraduationCap, label: 'Examen' },
  { href: '/progress', icon: BarChart2, label: 'Progreso' },
  { href: '/settings', icon: Settings, label: 'Ajustes' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { error: toastError } = useToast();
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);
  const enrollment = useActiveEnrollment();

  async function handleSignOut() {
    try {
      await authApi.logout();
      clearSession();
      router.push('/login');
    } catch {
      toastError('Error al cerrar sesión');
    }
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="hidden md:flex flex-col h-screen sticky top-0 bg-[var(--color-bg-card)] border-r border-[var(--color-border-default)] shrink-0 overflow-hidden"
    >
      <div className="flex items-center h-16 px-4 border-b border-[var(--color-border-default)] shrink-0">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2 flex-1"
            >
              <span className="text-lg">🎓</span>
              <span className="font-bold text-[var(--color-text-primary)]">LinguaMaestro</span>
            </motion.div>
          ) : (
            <motion.span
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-lg mx-auto"
            >
              🎓
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {enrollment && !sidebarCollapsed && (
        <div className="mx-3 mt-3 p-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">{enrollment.language_code === 'en' ? '🇬🇧' : enrollment.language_code === 'fr' ? '🇫🇷' : enrollment.language_code === 'ja' ? '🇯🇵' : enrollment.language_code === 'zh' ? '🇨🇳' : enrollment.language_code === 'pt' ? '🇧🇷' : '🇪🇸'}</span>
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">{enrollment.language_code}</span>
            </div>
            <Badge variant="level" level={enrollment.current_level}>{enrollment.current_level}</Badge>
          </div>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const item = (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] transition-all duration-150',
                'text-sm font-medium group',
                active
                  ? 'bg-[var(--color-accent-primary)]/12 text-[var(--color-accent-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
              )}
            >
              <Icon className={cn('h-4.5 w-4.5 shrink-0', active && 'text-[var(--color-accent-primary)]')} size={18} />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute left-0 w-0.5 h-6 bg-[var(--color-accent-primary)] rounded-r"
                />
              )}
            </Link>
          );

          return sidebarCollapsed ? (
            <SimpleTooltip key={href} content={label} side="right">
              <div className="relative">{item}</div>
            </SimpleTooltip>
          ) : (
            <div key={href} className="relative">{item}</div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-border-default)] p-3 space-y-1">
        <button
          onClick={handleSignOut}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-lg)] w-full',
            'text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/8 transition-all duration-150',
          )}
        >
          <LogOut size={18} className="shrink-0" />
          {!sidebarCollapsed && <span>Cerrar sesión</span>}
        </button>

        {!sidebarCollapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2">
            <UserAvatar src={user.avatar_url} name={user.full_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{user.full_name}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shadow-sm"
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
}
