import { api } from './client';
import type { CEFRLevel, LanguageCode } from '@/types/domain.types';

export const onboardingApi = {
  createEnrollment(languageCode: LanguageCode) {
    return api.post<{ success: true; data: unknown }>('/onboarding/enrollment', { languageCode });
  },
  setNativeLanguage(nativeLanguage: string) {
    return api.patch<{ success: true }>('/onboarding/native-language', { nativeLanguage });
  },
  setDiagnosticLevel(enrollmentId: string, level: CEFRLevel) {
    return api.patch<{ success: true }>('/onboarding/diagnostic', { enrollmentId, level });
  },
  complete(dailyGoalMinutes: number, activeDays: number[]) {
    return api.post<{ success: true }>('/onboarding/complete', { dailyGoalMinutes, activeDays });
  },
};
