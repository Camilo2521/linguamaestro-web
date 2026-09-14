import { api, sseUrl } from './client';
import type { ExamEligibility } from '@/types/domain.types';

export const examApi = {
  overview() {
    return api.get<{ success: true; data: any }>('/exam/overview');
  },
  eligibility(enrollmentId: string) {
    return api.get<{ success: true; data: ExamEligibility }>(`/exam/eligibility?enrollmentId=${enrollmentId}`);
  },
  createAttempt(enrollmentId: string) {
    return api.post<{ success: true; data: { attemptId: string } }>('/exam/attempts', { enrollmentId });
  },
  uploadVideo(attemptId: string, blob: Blob, durationSeconds: number, mimeType: string) {
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const form = new FormData();
    form.append('video', blob, `recording.${ext}`);
    form.append('durationSeconds', String(durationSeconds));
    return api.postForm<{ success: boolean; error?: string }>(`/exam/attempts/${attemptId}/video`, form);
  },
  results(attemptId: string) {
    return api.get<{ success: true; data: any }>(`/exam/attempts/${attemptId}`);
  },
  evaluateStreamUrl(attemptId: string) {
    return sseUrl(`/exam/attempts/${attemptId}/evaluate`);
  },
};
