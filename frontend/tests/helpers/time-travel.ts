import { vi } from 'vitest';

/** Freeze time at a specific date for the duration of a test block. */
export function freezeTime(isoDate: string) {
  const fixed = new Date(isoDate).getTime();
  vi.useFakeTimers();
  vi.setSystemTime(fixed);
  return () => vi.useRealTimers();
}

/** Advance the current fake time by N days. */
export function advanceDays(days: number) {
  vi.advanceTimersByTime(days * 24 * 60 * 60 * 1000);
}

/** Return a date string N days from now (or from a base date). */
export function daysFromNow(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Return a date string N days ago. */
export function daysAgo(days: number): string {
  return daysFromNow(-days);
}

/** Return a date string N months ago. */
export function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}
