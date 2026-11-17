import { api } from './client';
import type { PracticeMode, PracticePrompt, LanguageCode, CEFRLevel } from '@/types/domain.types';

export const practiceApi = {
  list(languageCode: LanguageCode, level: CEFRLevel, mode: PracticeMode) {
    return api.get<{ success: true; data: PracticePrompt[] }>(
      `/practice?languageCode=${languageCode}&level=${level}&mode=${mode}`,
    );
  },
  complete(
    promptId: string,
    enrollmentId: string,
    durationSeconds: number,
    extra?: { wordCount?: number; answer?: string; transcript?: string },
  ) {
    return api.post<{ success: boolean; error?: string; blocked?: boolean; data?: { xpEarned: number; correct: boolean | null } }>(
      `/practice/${promptId}/complete`,
      { enrollmentId, durationSeconds, ...extra },
    );
  },
};
