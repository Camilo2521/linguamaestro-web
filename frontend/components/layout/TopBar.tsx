'use client';

import { Bell, Flame } from 'lucide-react';
import { useActiveEnrollment, useSessionStore } from '@/stores/session.store';
import { useStreakProtection } from '@/hooks/useStreakProtection';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { SimpleTooltip } from '@/components/ui/tooltip';
import Link from 'next/link';

export function TopBar() {
  const user = useSessionStore((s) => s.user);
  const enrollment = useActiveEnrollment();
  const { data: streakData } = useStreakProtection();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-[var(--color-bg-base)]/80 backdrop-blur-sm border-b border-[var(--color-border-default)]">
      <div className="flex items-center gap-3">
        {enrollment && (
          <Badge variant="level" level={enrollment.current_level}>
            {enrollment.current_level}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        {streakData && (
          <SimpleTooltip content={`Racha: ${streakData.currentStreak} días`}>
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold transition-colors ${
                streakData.atRisk
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
              }`}
            >
              <Flame size={14} />
              <span>{streakData.currentStreak}</span>
            </div>
          </SimpleTooltip>
        )}

        <SimpleTooltip content="Notificaciones">
          <button className="relative flex items-center justify-center w-8 h-8 rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-colors">
            <Bell size={16} />
          </button>
        </SimpleTooltip>

        <Link href="/settings">
          <UserAvatar src={user?.avatar_url} name={user?.full_name} size="sm" />
        </Link>
      </div>
    </header>
  );
}
