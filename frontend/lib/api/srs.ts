import { api } from './client';

export const srsApi = {
  due(enrollmentId: string, limit = 20) {
    return api.get<{ success: true; data: any[] }>(`/srs/due?enrollmentId=${enrollmentId}&limit=${limit}`);
  },
  review(itemId: string, quality: 0 | 1 | 2 | 3 | 4 | 5, enrollmentId: string) {
    return api.post<{ success: boolean; error?: string }>(`/srs/${itemId}/review`, { quality, enrollmentId });
  },
  seed(enrollmentId: string, lessonId: string, vocabularyIds: string[]) {
    return api.post<{ success: true }>('/srs/seed', { enrollmentId, lessonId, vocabularyIds });
  },
};
