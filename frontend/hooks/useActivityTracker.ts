'use client';

import { useRef, useCallback, useEffect } from 'react';
import { activityApi } from '@/lib/api/activity';
import { useActiveEnrollment } from '@/stores/session.store';

interface UseActivityTrackerOptions {
  activityType: string;
  xpPerMinute?: number;
  metadata?: Record<string, unknown>;
  autoStart?: boolean;
}

export function useActivityTracker({
  activityType,
  xpPerMinute = 10,
  metadata,
  autoStart = false,
}: UseActivityTrackerOptions) {
  const enrollment = useActiveEnrollment();
  const startTimeRef = useRef<Date | null>(null);
  const isTrackingRef = useRef(false);

  const start = useCallback(() => {
    if (isTrackingRef.current) return;
    startTimeRef.current = new Date();
    isTrackingRef.current = true;
  }, []);

  const stop = useCallback(async (): Promise<boolean> => {
    if (!isTrackingRef.current || !startTimeRef.current || !enrollment) return false;

    const durationMs = Date.now() - startTimeRef.current.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    isTrackingRef.current = false;
    startTimeRef.current = null;

    if (durationMinutes < 1) return false;

    const xpEarned = durationMinutes * xpPerMinute;
    const result = await activityApi.log(enrollment.id, activityType, durationMinutes, xpEarned, metadata);
    return result.success;
  }, [enrollment, activityType, xpPerMinute, metadata]);

  useEffect(() => {
    if (autoStart) start();

    return () => {
      if (isTrackingRef.current) {
        stop();
      }
    };
  }, [autoStart, start, stop]);

  return { start, stop, isTracking: isTrackingRef.current };
}
