import { describe, it, expect } from 'vitest';
import { computeSchedule, computeScheduleISO } from '../src/utils/srs-schedule.js';

const BASE = { easeFactor: 2.5, intervalDays: 1, repetitions: 0 };
const NOW = new Date('2025-06-01T12:00:00Z');

describe('computeSchedule — ease factor', () => {
  it('never drops below 1.3', () => {
    // Repeatedly fail to drive ease factor down
    let ease = 2.5;
    for (let i = 0; i < 20; i++) {
      const r = computeSchedule(0, ease, 1, i, NOW);
      ease = r.newEase;
    }
    expect(ease).toBeGreaterThanOrEqual(1.3);
  });

  it('increases with perfect quality (5)', () => {
    const before = 2.5;
    const { newEase } = computeSchedule(5, before, 6, 2, NOW);
    expect(newEase).toBeGreaterThan(before);
  });

  it('decreases with quality 3 compared to quality 5', () => {
    const { newEase: easeQ3 } = computeSchedule(3, 2.5, 6, 2, NOW);
    const { newEase: easeQ5 } = computeSchedule(5, 2.5, 6, 2, NOW);
    expect(easeQ3).toBeLessThan(easeQ5);
  });
});

describe('computeSchedule — interval progression', () => {
  it('quality < 3 resets to 1-day interval', () => {
    const { newInterval } = computeSchedule(2, 2.5, 30, 5, NOW);
    expect(newInterval).toBe(1);
  });

  it('quality < 3 resets repetitions to 0', () => {
    const { newRepetitions } = computeSchedule(1, 2.5, 30, 5, NOW);
    expect(newRepetitions).toBe(0);
  });

  it('first successful review (rep=0) → 1-day interval', () => {
    const { newInterval, newRepetitions } = computeSchedule(3, 2.5, 1, 0, NOW);
    expect(newInterval).toBe(1);
    expect(newRepetitions).toBe(1);
  });

  it('second successful review (rep=1) → 6-day interval', () => {
    const { newInterval, newRepetitions } = computeSchedule(4, 2.5, 1, 1, NOW);
    expect(newInterval).toBe(6);
    expect(newRepetitions).toBe(2);
  });

  it('subsequent reviews grow interval by the updated ease factor', () => {
    const ease = 2.5;
    const currentInterval = 6;
    // SM-2 uses the ease factor *after* it's adjusted for this review's
    // quality, not the value passed in — assert against `newEase`, not `ease`.
    const { newInterval, newEase } = computeSchedule(3, ease, currentInterval, 2, NOW);
    expect(newInterval).toBe(Math.round(currentInterval * newEase));
  });

  it('higher quality → longer interval than lower quality', () => {
    const { newInterval: intervalQ3 } = computeSchedule(3, 2.5, 10, 3, NOW);
    const { newInterval: intervalQ5 } = computeSchedule(5, 2.5, 10, 3, NOW);
    expect(intervalQ5).toBeGreaterThanOrEqual(intervalQ3);
  });
});

describe('computeSchedule — next review date', () => {
  it('schedules review exactly `newInterval` UTC days from now', () => {
    const { newInterval, nextReviewDate } = computeSchedule(3, 2.5, 1, 1, NOW);
    expect(newInterval).toBe(6);
    expect(nextReviewDate.toISOString()).toBe('2025-06-07T12:00:00.000Z');
  });

  it('crosses month and year boundaries correctly', () => {
    const { nextReviewDate } = computeSchedule(4, 2.5, 6, 2, new Date('2025-12-20T08:00:00Z'));
    // 6 × 2.5 = 15 days after Dec 20
    expect(nextReviewDate.toISOString()).toBe('2026-01-04T08:00:00.000Z');
  });
});

describe('computeScheduleISO', () => {
  it('returns ISO string for nextReview', () => {
    const { nextReview } = computeScheduleISO(3, 2.5, 1, 0, NOW);
    expect(nextReview).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('matches date from computeSchedule', () => {
    const iso = computeScheduleISO(4, 2.5, 6, 1, NOW);
    const plain = computeSchedule(4, 2.5, 6, 1, NOW);
    expect(iso.nextReview).toBe(plain.nextReviewDate.toISOString());
  });
});

describe('computeSchedule — boundary: worst quality (0)', () => {
  it('q=0 resets reps and gives 1-day interval', () => {
    const { newRepetitions, newInterval } = computeSchedule(0, 2.5, 100, 10, NOW);
    expect(newRepetitions).toBe(0);
    expect(newInterval).toBe(1);
  });

  it('q=0 clamps ease to 1.3 if it would go lower', () => {
    const { newEase } = computeSchedule(0, 1.31, 1, 0, NOW);
    expect(newEase).toBeGreaterThanOrEqual(1.3);
  });
});

describe('computeSchedule — boundary: best quality (5)', () => {
  it('q=5 maximises ease factor growth', () => {
    const { newEase } = computeSchedule(5, 2.5, 1, 0, NOW);
    // q=5: delta = 0.1 - (5-5)*(0.08 + ...) = +0.1
    expect(newEase).toBeCloseTo(2.6, 5);
  });
});

describe('computeSchedule — uses provided `now`', () => {
  it('is deterministic with fixed `now`', () => {
    const r1 = computeSchedule(3, 2.5, 1, 1, NOW);
    const r2 = computeSchedule(3, 2.5, 1, 1, NOW);
    expect(r1.nextReviewDate.toISOString()).toBe(r2.nextReviewDate.toISOString());
  });

  it('produces different dates for different `now` values', () => {
    const now1 = new Date('2025-01-01T00:00:00Z');
    const now2 = new Date('2025-06-01T00:00:00Z');
    const r1 = computeSchedule(3, 2.5, 1, 1, now1);
    const r2 = computeSchedule(3, 2.5, 1, 1, now2);
    expect(r1.nextReviewDate.toISOString()).not.toBe(r2.nextReviewDate.toISOString());
  });
});

describe('SM-2 reference values', () => {
  it.each([
    [5, 0.1],
    [4, 0],
    [3, -0.14],
    [2, -0.32],
    [1, -0.54],
    [0, -0.8],
  ])('quality %i changes EF by %f', (q, delta) => {
    const { newEase } = computeSchedule(q, 2.5, 6, 2, NOW);
    expect(newEase).toBeCloseTo(2.5 + delta, 10);
  });

  it('follows the 1 → 6 → round(I × EF) interval sequence for a new card', () => {
    let { easeFactor, intervalDays, repetitions } = BASE;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = computeSchedule(4, easeFactor, intervalDays, repetitions, NOW);
      ({ newEase: easeFactor, newInterval: intervalDays, newRepetitions: repetitions } = r);
      intervals.push(intervalDays);
    }
    // EF stays 2.5 at q=4: 1, 6, 6×2.5 = 15, 15×2.5 = 37.5 → 38
    expect(intervals).toEqual([1, 6, 15, 38]);
    expect(repetitions).toBe(4);
  });

  it('a lapse after a long streak restarts the card but keeps the lowered EF (product decision)', () => {
    const r = computeSchedule(2, 2.5, 38, 4, NOW);
    expect(r.newRepetitions).toBe(0);
    expect(r.newInterval).toBe(1);
    expect(r.newEase).toBeCloseTo(2.18, 10);
    // The next successful review starts the sequence again from 1 day.
    const next = computeSchedule(4, r.newEase, r.newInterval, r.newRepetitions, NOW);
    expect(next.newInterval).toBe(1);
  });

  it('EF never goes below 1.3, even after many lapses', () => {
    let ease = 2.5;
    for (let i = 0; i < 10; i++) ease = computeSchedule(0, ease, 1, 0, NOW).newEase;
    expect(ease).toBe(1.3);
  });
});
