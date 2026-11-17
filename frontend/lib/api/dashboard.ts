import { api } from './client';

export const dashboardApi = {
  get() {
    return api.get<{ success: true; data: { profile: any; enrollment: any; stats: any; activeDates: string[]; nextLesson: any } }>(
      '/dashboard',
    );
  },
  progress() {
    return api.get<{ success: true; data: { enrollment: any; logs: any[] } }>('/dashboard/progress');
  },
  updateDailyGoal(dailyGoalMinutes: number) {
    return api.patch<{ success: true }>('/dashboard/settings/daily-goal', { dailyGoalMinutes });
  },
};
