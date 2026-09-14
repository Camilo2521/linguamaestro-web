'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StatsGrid } from '@/components/dashboard/StatsGrid';
import { DailyProgress } from '@/components/dashboard/DailyProgress';
import { LevelProgress } from '@/components/dashboard/LevelProgress';
import { TodayPlan } from '@/components/dashboard/TodayPlan';
import { StreakCalendar } from '@/components/dashboard/StreakCalendar';
import { CardSkeleton } from '@/components/ui/skeleton';
import { dashboardApi } from '@/lib/api/dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardApi.get>>['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dashboardApi.get().then((res) => {
      if (cancelled) return;
      if (!res.data.enrollment) {
        router.replace('/onboarding/language');
        return;
      }
      setData(res.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [router]);

  if (loading || !data || !data.enrollment || !data.stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const { profile, enrollment, stats, activeDates, nextLesson } = data;
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Estudiante';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Aquí está tu resumen de hoy
        </p>
      </div>

      <StatsGrid stats={stats} streak={profile?.current_streak ?? 0} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DailyProgress />
        <LevelProgress
          level={enrollment.current_level}
          hoursStudied={enrollment.total_study_hours ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TodayPlan srsCount={stats.srs_cards_due} nextLesson={nextLesson} />
        <StreakCalendar
          currentStreak={profile?.current_streak ?? 0}
          longestStreak={profile?.longest_streak ?? 0}
          activeDates={activeDates}
        />
      </div>
    </div>
  );
}
