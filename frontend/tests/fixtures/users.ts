import type { UserProfile } from '@/types/domain.types';

export const baseUser: UserProfile = {
  id: 'user-123',
  email: 'test@linguamaestro.com',
  full_name: 'Ana García',
  display_name: 'Ana',
  native_language: 'es',
  learning_goals: ['travel', 'work'],
  avatar_url: null,
  timezone: 'America/Bogota',
  daily_goal_minutes: 30,
  active_days: [1, 2, 3, 4, 5],
  onboarding_completed: true,
  current_streak: 7,
  longest_streak: 14,
  last_activity_date: new Date().toISOString().slice(0, 10),
  streak_freezes: 2,
  created_at: '2024-01-01T00:00:00Z',
};

export function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return { ...baseUser, ...overrides };
}
