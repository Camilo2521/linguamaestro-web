'use client';

import { useQuery } from '@tanstack/react-query';
import { examApi } from '@/lib/api/exam';
import { useActiveEnrollment } from '@/stores/session.store';

export function useExamEligibility() {
  const enrollment = useActiveEnrollment();

  return useQuery({
    queryKey: ['exam-eligibility', enrollment?.id],
    queryFn: () => examApi.eligibility(enrollment!.id),
    enabled: !!enrollment?.id,
    staleTime: 5 * 60 * 1000,
  });
}
