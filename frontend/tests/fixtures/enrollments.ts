import type { Enrollment } from '@/types/domain.types';

/** 120 days ago — satisfies the A1 3-month requirement */
const STARTED_AT_4_MONTHS_AGO = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString();
const STARTED_AT_1_MONTH_AGO = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString();

export const eligibleA1Enrollment: Enrollment = {
  id: 'enroll-eligible',
  user_id: 'user-123',
  language_code: 'en',
  current_level: 'A1',
  active: true,
  total_study_hours: 95,        // > 90h required
  daily_goal_minutes: 30,
  started_at: STARTED_AT_4_MONTHS_AGO, // > 3 months required
  diagnostic_completed: true,
  exam_attempts_count: 0,
  created_at: STARTED_AT_4_MONTHS_AGO,
  updated_at: new Date().toISOString(),
};

export const ineligibleHoursEnrollment: Enrollment = {
  ...eligibleA1Enrollment,
  id: 'enroll-no-hours',
  total_study_hours: 50,        // < 90h required
};

export const ineligibleMonthsEnrollment: Enrollment = {
  ...eligibleA1Enrollment,
  id: 'enroll-no-months',
  started_at: STARTED_AT_1_MONTH_AGO, // < 3 months required
};

export const eligibleB1Enrollment: Enrollment = {
  ...eligibleA1Enrollment,
  id: 'enroll-b1',
  current_level: 'B1',
  total_study_hours: 320,       // > 300h required
  started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 160).toISOString(), // > 5 months
};

export function makeEnrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return { ...eligibleA1Enrollment, ...overrides };
}
