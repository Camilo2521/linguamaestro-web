export interface ScheduleResult {
  newEase: number;
  newInterval: number;
  newRepetitions: number;
  nextReviewDate: Date;
}

/**
 * SM-2 spaced-repetition scheduling (Wozniak, SuperMemo 2).
 *
 * - quality: 0-5 self-grade for this review.
 * - EF' = max(1.3, EF + 0.1 − (5 − q)(0.08 + (5 − q)·0.02)), applied on every
 *   review. Note: the original SM-2 leaves EF unchanged when q < 3; lowering
 *   it on failures too (as Anki-style variants do) is a deliberate product
 *   decision — hard cards get reviewed more often.
 * - q < 3: repetitions reset to 0 and the card is due again in 1 day.
 * - q ≥ 3: repetitions + 1; interval 1 day, then 6 days, then
 *   round(previous interval × EF').
 */
export function computeSchedule(
  quality: number,
  easeFactor: number,
  intervalDays: number,
  repetitions: number,
  now = new Date(),
): ScheduleResult {
  let newEase = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  newEase = Math.max(1.3, newEase);

  let newInterval: number;
  let newRepetitions: number;

  if (quality < 3) {
    newInterval = 1;
    newRepetitions = 0;
  } else {
    newRepetitions = repetitions + 1;
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(intervalDays * newEase);
  }

  // UTC day arithmetic: the result must not depend on the server's local
  // time zone / DST rules (the rest of the backend works in UTC too).
  const nextReviewDate = new Date(now);
  nextReviewDate.setUTCDate(nextReviewDate.getUTCDate() + newInterval);

  return { newEase, newInterval, newRepetitions, nextReviewDate };
}

export function computeScheduleISO(
  quality: number,
  easeFactor: number,
  intervalDays: number,
  repetitions: number,
  now?: Date,
): Omit<ScheduleResult, 'nextReviewDate'> & { nextReview: string } {
  const result = computeSchedule(quality, easeFactor, intervalDays, repetitions, now);
  return {
    newEase: result.newEase,
    newInterval: result.newInterval,
    newRepetitions: result.newRepetitions,
    nextReview: result.nextReviewDate.toISOString(),
  };
}
