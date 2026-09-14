'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useSessionStore } from '@/stores/session.store';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  atRisk: boolean;
  freezesAvailable: number;
}

async function fetchStreak(): Promise<StreakData> {
  const { data } = await authApi.me();
  const user = data.user;

  const lastDate = user?.last_activity_date ? new Date(user.last_activity_date) : null;
  const today = new Date();
  const daysSinceActivity = lastDate
    ? Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  return {
    currentStreak: user?.current_streak ?? 0,
    longestStreak: user?.longest_streak ?? 0,
    lastActivityDate: user?.last_activity_date ?? null,
    atRisk: daysSinceActivity >= 1,
    freezesAvailable: user?.streak_freezes ?? 0,
  };
}

export function useStreakProtection() {
  const user = useSessionStore((s) => s.user);

  return useQuery({
    queryKey: ['streak', user?.id],
    queryFn: () => fetchStreak(),
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });
}
