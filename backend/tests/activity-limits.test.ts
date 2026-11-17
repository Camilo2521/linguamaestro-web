import { describe, it, expect } from 'vitest';
import {
  validateSessionDuration,
  checkDailyLimit,
  computeXP,
  MAX_DAILY_MINUTES,
  MIN_SESSION_MINUTES,
} from '../src/utils/activity-limits.js';

describe('validateSessionDuration', () => {
  it('accepts exactly MIN_SESSION_MINUTES', () => {
    expect(validateSessionDuration(MIN_SESSION_MINUTES).valid).toBe(true);
  });

  it('accepts sessions longer than minimum', () => {
    expect(validateSessionDuration(60).valid).toBe(true);
  });

  it('rejects sessions one minute short of minimum', () => {
    const result = validateSessionDuration(MIN_SESSION_MINUTES - 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(`${MIN_SESSION_MINUTES}`);
  });

  it('rejects zero-minute session', () => {
    expect(validateSessionDuration(0).valid).toBe(false);
  });

  it('rejects negative duration', () => {
    expect(validateSessionDuration(-5).valid).toBe(false);
  });

  it('error message contains the minimum', () => {
    const { error } = validateSessionDuration(5);
    expect(error).toMatch(/15/);
  });

  it('MIN_SESSION_MINUTES constant is 15', () => {
    expect(MIN_SESSION_MINUTES).toBe(15);
  });
});

describe('checkDailyLimit', () => {
  it('allows session when well under cap', () => {
    const { allowed, remaining } = checkDailyLimit(60, 30);
    expect(allowed).toBe(true);
    expect(remaining).toBe(MAX_DAILY_MINUTES - 60);
  });

  it('allows session that exactly fills remaining cap', () => {
    const { allowed } = checkDailyLimit(300, 60);  // 300 + 60 = 360 = MAX
    expect(allowed).toBe(true);
  });

  it('blocks session that would exceed cap by 1 minute', () => {
    const { allowed } = checkDailyLimit(300, 61);  // 300 + 61 > 360
    expect(allowed).toBe(false);
  });

  it('blocks when already at cap', () => {
    const { allowed, remaining } = checkDailyLimit(MAX_DAILY_MINUTES, 15);
    expect(allowed).toBe(false);
    expect(remaining).toBe(0);
  });

  it('blocks when already over cap (data integrity edge case)', () => {
    const { allowed } = checkDailyLimit(400, 15);
    expect(allowed).toBe(false);
  });

  it('remaining is never negative', () => {
    const { remaining } = checkDailyLimit(400, 15);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('MAX_DAILY_MINUTES constant is 360', () => {
    expect(MAX_DAILY_MINUTES).toBe(360);
  });

  it('remaining reflects actual minutes left', () => {
    const { remaining } = checkDailyLimit(100, 30);
    expect(remaining).toBe(MAX_DAILY_MINUTES - 100);
  });
});

describe('computeXP', () => {
  it('multiplies duration by rate', () => {
    expect(computeXP(30, 10)).toBe(300);
  });

  it('returns 0 for 0-minute session', () => {
    expect(computeXP(0, 10)).toBe(0);
  });

  it('returns 0 for 0 rate', () => {
    expect(computeXP(30, 0)).toBe(0);
  });

  it('never returns negative XP', () => {
    expect(computeXP(-5, 10)).toBeGreaterThanOrEqual(0);
  });

  it('is proportional to duration', () => {
    const xp10 = computeXP(10, 5);
    const xp20 = computeXP(20, 5);
    expect(xp20).toBe(xp10 * 2);
  });

  it('supports fractional rates', () => {
    expect(computeXP(60, 0.5)).toBe(30);
  });
});

describe('anti-fraud combined scenarios', () => {
  it('short session inside daily cap — both fail at session check', () => {
    const session = validateSessionDuration(5);
    expect(session.valid).toBe(false);
    // daily limit check not reached
  });

  it('long session that maxes out the daily cap — exactly at limit', () => {
    const session = validateSessionDuration(MAX_DAILY_MINUTES);
    expect(session.valid).toBe(true);

    const limit = checkDailyLimit(0, MAX_DAILY_MINUTES);
    expect(limit.allowed).toBe(true);
  });

  it('normal 30-min session after 5.5h of study exactly reaches the cap — still allowed', () => {
    const alreadyStudied = 330; // 5h30m
    const newSession = 30;

    const session = validateSessionDuration(newSession);
    expect(session.valid).toBe(true);

    const limit = checkDailyLimit(alreadyStudied, newSession);
    expect(limit.allowed).toBe(true); // 330 + 30 = 360 = MAX, at-cap is allowed (see boundary tests above)
  });

  it('normal 31-min session after 5.5h of study is blocked', () => {
    const alreadyStudied = 330;
    const newSession = 31;

    const limit = checkDailyLimit(alreadyStudied, newSession);
    expect(limit.allowed).toBe(false); // 330 + 31 = 361 > 360
  });
});
