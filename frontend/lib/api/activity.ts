import { api } from './client';

export const activityApi = {
  log(enrollmentId: string, activityType: string, durationMinutes: number, xpEarned: number, metadata?: Record<string, unknown>) {
    return api.post<{ success: boolean; error?: string; blocked?: boolean }>('/activity', {
      enrollmentId,
      activityType,
      durationMinutes,
      xpEarned,
      metadata,
    });
  },
  daily() {
    return api.get<{ success: true; data: { logs: any[]; totalMinutes: number; totalXP: number; limitMinutes: number } }>(
      '/activity/daily',
    );
  },
};
