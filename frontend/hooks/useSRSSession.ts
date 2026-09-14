'use client';

import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { srsApi } from '@/lib/api/srs';
import { useSRSStore, useCurrentCard, useSRSProgress } from '@/stores/srs.store';
import { useActiveEnrollment } from '@/stores/session.store';
import { useToast } from '@/stores/ui.store';

export function useSRSSession() {
  const enrollment = useActiveEnrollment();
  const { setQueue, flipCard, rateCard, resetSession } = useSRSStore();
  const currentCard = useCurrentCard();
  const progress = useSRSProgress();
  const queryClient = useQueryClient();
  const { error: toastError } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['srs-due', enrollment?.id],
    queryFn: () => srsApi.due(enrollment!.id),
    enabled: !!enrollment?.id,
    staleTime: 0,
  });

  // Start every visit to the review screen with a clean session tally —
  // otherwise stats left over from a previous visit (this store isn't
  // reset on navigation) would carry into the new one.
  useEffect(() => {
    resetSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (data?.success && data.data) {
      setQueue(data.data as any);
    }
  }, [data, setQueue]);

  const reviewMutation = useMutation({
    mutationFn: async ({ itemId, quality }: { itemId: string; quality: 0 | 1 | 2 | 3 | 4 | 5 }) => {
      const result = await srsApi.review(itemId, quality, enrollment!.id);
      if (!result.success) throw new Error(result.error ?? 'No se pudo guardar la repetición');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['srs-due'] });
    },
    onError: (err) => {
      toastError(err instanceof Error ? err.message : 'No se pudo guardar la repetición');
    },
  });

  const handleRate = useCallback((quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!currentCard) return;
    rateCard(quality);
    reviewMutation.mutate({ itemId: currentCard.id, quality });
  }, [currentCard, rateCard, reviewMutation]);

  return {
    currentCard,
    progress,
    isLoading,
    isFinished: progress.isFinished,
    flipCard,
    handleRate,
    resetSession,
  };
}
