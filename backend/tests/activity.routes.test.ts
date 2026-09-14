import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../src/lib/supabase.js', () => ({
  getUserClient: vi.fn(),
  serviceClient: {},
  anonClient: {},
}));

import { createApp } from '../src/app.js';
import { getUserClient } from '../src/lib/supabase.js';
import { makeMockClient, makeQueryBuilder } from './helpers/mockSupabase.js';
import { MAX_DAILY_MINUTES } from '../src/utils/activity-limits.js';

const mockGetUserClient = vi.mocked(getUserClient);
const app = createApp();
const AUTH = { Authorization: 'Bearer test-token' };

function setup(opts: { userId?: string | null; todayLogs?: { duration_minutes: number }[]; insertError?: unknown } = {}) {
  const todayLogs = opts.todayLogs ?? [];
  // Only forward `userId` when the caller actually passed it — makeMockClient
  // distinguishes "key omitted" (default user) from "explicit null" (no
  // user) via `'userId' in opts`, so always including the key here (even as
  // `undefined`) would defeat that and make every call look unauthenticated.
  const client = makeMockClient({
    ...('userId' in opts ? { userId: opts.userId } : {}),
    from: () =>
      makeQueryBuilder(opts.insertError
        ? { data: null, error: opts.insertError }
        : { data: todayLogs, error: null }),
  });
  mockGetUserClient.mockReturnValue(client as any);
  return client;
}

describe('POST /activity — authentication', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).post('/activity').send({});
    expect(res.status).toBe(401);
  });

  it('returns 401 when the token does not resolve to a user', async () => {
    setup({ userId: null });
    const res = await request(app).post('/activity').set(AUTH).send({
      enrollmentId: '11111111-1111-1111-1111-111111111111',
      activityType: 'lesson',
      durationMinutes: 30,
      xpEarned: 300,
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /activity — minimum session enforcement', () => {
  beforeEach(() => setup());

  it('rejects a session of 14 minutes (below 15-min minimum)', async () => {
    const res = await request(app).post('/activity').set(AUTH).send({
      enrollmentId: '11111111-1111-1111-1111-111111111111',
      activityType: 'lesson',
      durationMinutes: 14,
      xpEarned: 140,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('15');
  });

  it('accepts a session of exactly 15 minutes', async () => {
    const res = await request(app).post('/activity').set(AUTH).send({
      enrollmentId: '11111111-1111-1111-1111-111111111111',
      activityType: 'lesson',
      durationMinutes: 15,
      xpEarned: 150,
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /activity — daily cap enforcement', () => {
  it('blocks when adding the session would exceed 360 min', async () => {
    setup({ todayLogs: [{ duration_minutes: 350 }] });
    const res = await request(app).post('/activity').set(AUTH).send({
      enrollmentId: '11111111-1111-1111-1111-111111111111',
      activityType: 'lesson',
      durationMinutes: 30,
      xpEarned: 300,
    });
    expect(res.status).toBe(429);
    expect(res.body.blocked).toBe(true);
    expect(res.body.error).toContain(`${MAX_DAILY_MINUTES}`);
  });

  it('allows a session that exactly fills the remaining cap', async () => {
    setup({ todayLogs: [{ duration_minutes: 300 }] });
    const res = await request(app).post('/activity').set(AUTH).send({
      enrollmentId: '11111111-1111-1111-1111-111111111111',
      activityType: 'lesson',
      durationMinutes: 60,
      xpEarned: 600,
    });
    expect(res.status).toBe(200);
    expect(res.body.blocked).toBeUndefined();
  });

  it('aggregates multiple log entries for today', async () => {
    setup({ todayLogs: [{ duration_minutes: 180 }, { duration_minutes: 150 }] });
    const res = await request(app).post('/activity').set(AUTH).send({
      enrollmentId: '11111111-1111-1111-1111-111111111111',
      activityType: 'lesson',
      durationMinutes: 60, // 180+150+60=390 > 360
      xpEarned: 600,
    });
    expect(res.status).toBe(429);
    expect(res.body.blocked).toBe(true);
  });
});

describe('POST /activity — xpEarned bound (anti-farming)', () => {
  it('clamps a tampered xpEarned down to the per-minute ceiling', async () => {
    let insertedXp: number | undefined;
    const client = makeMockClient({
      from: (table: string) => {
        const builder = makeQueryBuilder({ data: [], error: null });
        if (table === 'activity_logs') {
          const originalInsert = builder['insert'] as ReturnType<typeof vi.fn>;
          originalInsert.mockImplementation((row: any) => {
            insertedXp = row.xp_earned;
            return builder;
          });
        }
        return builder;
      },
    });
    mockGetUserClient.mockReturnValue(client as any);

    const res = await request(app).post('/activity').set(AUTH).send({
      enrollmentId: '11111111-1111-1111-1111-111111111111',
      activityType: 'lesson',
      durationMinutes: 15,
      xpEarned: 999999, // way above any legitimate rate for 15 minutes
    });

    expect(res.status).toBe(200);
    expect(insertedXp).toBeLessThanOrEqual(15 * 20); // MAX_XP_PER_MINUTE
  });
});

describe('POST /activity — database error handling', () => {
  it('returns an error when the insert fails', async () => {
    setup({ insertError: { message: 'unique constraint violated' } });
    const res = await request(app).post('/activity').set(AUTH).send({
      enrollmentId: '11111111-1111-1111-1111-111111111111',
      activityType: 'lesson',
      durationMinutes: 30,
      xpEarned: 300,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('unique constraint');
  });
});

describe('GET /activity/daily — authentication', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/activity/daily');
    expect(res.status).toBe(401);
  });
});
