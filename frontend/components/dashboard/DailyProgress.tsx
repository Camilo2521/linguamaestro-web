'use client';

import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDailyProgress } from '@/hooks/useDailyProgress';
import { useActiveEnrollment, useSessionStore } from '@/stores/session.store';
import { Skeleton } from '@/components/ui/skeleton';

export function DailyProgress() {
  const enrollment = useActiveEnrollment();
  const user = useSessionStore((s) => s.user);
  const { data, isLoading } = useDailyProgress();

  if (isLoading) return <Skeleton height={120} className="rounded-[var(--radius-xl)]" />;
  if (!data?.success || !enrollment) return null;

  const { totalMinutes, limitMinutes, totalXP } = data.data;
  // The goal a user sets in Settings (PATCH /dashboard/settings/daily-goal)
  // only ever writes users.daily_goal_minutes — enrollments.daily_goal_minutes
  // is a separate column that's stuck at its schema default (30) forever,
  // since nothing updates it after the enrollment row is created.
  const goalMinutes = user?.daily_goal_minutes ?? 30;
  const pct = Math.min(100, Math.round((totalMinutes / goalMinutes) * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Progreso de hoy</span>
          <span className="text-sm font-normal text-[var(--color-text-secondary)]">
            {totalMinutes} / {goalMinutes} min
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress
          value={pct}
          color={pct >= 100 ? '#10B981' : 'var(--color-accent-primary)'}
          size="md"
          animated
        />
        <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
          <span>{pct}% del objetivo diario</span>
          <span className="text-[var(--color-accent-gold)] font-semibold">+{totalXP} XP</span>
        </div>
        {pct >= 100 && (
          <p className="text-xs font-medium text-emerald-400 text-center">
            🎉 ¡Objetivo diario completado!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
