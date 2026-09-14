'use client';

import { useQuery } from '@tanstack/react-query';
import { activityApi } from '@/lib/api/activity';
import { useActiveEnrollment } from '@/stores/session.store';

export function useDailyProgress() {
  const enrollment = useActiveEnrollment();

  return useQuery({
    queryKey: ['daily-activity', enrollment?.id],
    queryFn: () => activityApi.daily(),
    enabled: !!enrollment?.id,
    refetchInterval: 60 * 1000,
  });
}
