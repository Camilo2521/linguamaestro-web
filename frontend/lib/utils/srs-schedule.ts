export interface ScheduleResult {
  newEase: number;
  newInterval: number;
  newRepetitions: number;
  nextReviewDate: Date;
}

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

  const nextReviewDate = new Date(now);
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

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
