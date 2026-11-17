import { api } from './client';
import type { Lesson, LessonProgress } from '@/types/domain.types';

export const lessonsApi = {
  list(enrollmentId: string) {
    return api.get<{ success: true; data: { lessons: Lesson[]; progress: LessonProgress[] } }>(
      `/lessons?enrollmentId=${enrollmentId}`,
    );
  },
  get(lessonId: string, enrollmentId: string) {
    return api.get<{ success: true; data: { lesson: any; exercises: any[]; enrollmentId: string } }>(
      `/lessons/${lessonId}?enrollmentId=${enrollmentId}`,
    );
  },
  complete(lessonId: string, enrollmentId: string, score: number, timeSpentSeconds: number) {
    return api.post<{ success: true; data: { xpEarned: number; leveledUp: string | null } }>(`/lessons/${lessonId}/complete`, {
      enrollmentId,
      score,
      timeSpentSeconds,
    });
  },
};
