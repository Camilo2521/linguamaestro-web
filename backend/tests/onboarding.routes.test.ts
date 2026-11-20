import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/lib/supabase.js', () => ({
  getUserClient: vi.fn(),
  getServiceClient: () => ({}),
  anonClient: {},
}));

import { createApp } from '../src/app.js';
import { getUserClient } from '../src/lib/supabase.js';
import { makeFakeDb, makeMockClient, type QueryCall } from './helpers/mockSupabase.js';

const mockGetUserClient = vi.mocked(getUserClient);
const app = createApp();
const AUTH = { Authorization: 'Bearer test-token' };
const USER_ID = 'user-123';
const ENROLLMENT_ID = '11111111-1111-1111-1111-111111111111';

function setup(handler: (c: QueryCall) => { data: unknown; error: unknown; count?: number | null }) {
  const db = makeFakeDb(handler);
  mockGetUserClient.mockReturnValue(makeMockClient({ userId: USER_ID, from: db.from as any }) as any);
  return db;
}

describe('onboarding — authentication', () => {
  it.each([
    ['post', '/onboarding/enrollment'],
    ['patch', '/onboarding/native-language'],
    ['patch', '/onboarding/diagnostic'],
    ['post', '/onboarding/complete'],
  ] as const)('%s %s returns 401 without a token', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
  });

  it('returns 401 when Supabase rejects the token', async () => {
    mockGetUserClient.mockReturnValue(makeMockClient({ userId: null }) as any);
    const res = await request(app).post('/onboarding/enrollment').set(AUTH).send({ languageCode: 'en' });
    expect(res.status).toBe(401);
  });
});

describe('POST /onboarding/enrollment', () => {
  it('creates an A1 enrollment owned by the caller', async () => {
    const db = setup(() => ({ data: { id: ENROLLMENT_ID }, error: null }));
    const res = await request(app).post('/onboarding/enrollment').set(AUTH).send({ languageCode: 'ja' });
    expect(res.status).toBe(200);
    const [insert] = db.calls.filter((c) => c.op === 'insert');
    // user_id comes from the token, never from the body.
    expect(insert!.payload).toMatchObject({ user_id: USER_ID, language_code: 'ja', current_level: 'A1' });
  });

  it('rejects an unsupported language', async () => {
    setup(() => ({ data: null, error: null }));
    const res = await request(app).post('/onboarding/enrollment').set(AUTH).send({ languageCode: 'de' });
    expect(res.status).toBe(400);
  });

  it('ignores a user_id smuggled in the body', async () => {
    const db = setup(() => ({ data: { id: ENROLLMENT_ID }, error: null }));
    await request(app).post('/onboarding/enrollment').set(AUTH).send({ languageCode: 'en', user_id: 'someone-else' });
    const [insert] = db.calls.filter((c) => c.op === 'insert');
    expect((insert!.payload as Record<string, unknown>)['user_id']).toBe(USER_ID);
  });
});

describe('PATCH /onboarding/diagnostic — one placement per enrollment', () => {
  it('sets the level the first time, guarded by diagnostic_completed = false', async () => {
    const db = setup((c) => ({ data: c.op === 'update' ? [{ id: ENROLLMENT_ID }] : null, error: null }));
    const res = await request(app).patch('/onboarding/diagnostic').set(AUTH).send({ enrollmentId: ENROLLMENT_ID, level: 'B1' });
    expect(res.status).toBe(200);
    const [update] = db.calls.filter((c) => c.op === 'update');
    expect(update!.payload).toEqual({ current_level: 'B1', diagnostic_completed: true });
    expect(update!.filters).toMatchObject({ id: ENROLLMENT_ID, user_id: USER_ID, diagnostic_completed: false });
  });

  it('returns 409 when the placement was already done (cannot jump levels later)', async () => {
    setup((c) => ({ data: c.op === 'update' ? [] : { id: ENROLLMENT_ID }, error: null }));
    const res = await request(app).patch('/onboarding/diagnostic').set(AUTH).send({ enrollmentId: ENROLLMENT_ID, level: 'NATIVE' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DIAGNOSTIC_ALREADY_COMPLETED');
  });

  it("returns 404 for an enrollment that isn't the caller's", async () => {
    setup((c) => ({ data: c.op === 'update' ? [] : null, error: null }));
    const res = await request(app).patch('/onboarding/diagnostic').set(AUTH).send({ enrollmentId: ENROLLMENT_ID, level: 'B1' });
    expect(res.status).toBe(404);
  });

  it.each([
    [{ enrollmentId: 'not-a-uuid', level: 'B1' }],
    [{ enrollmentId: ENROLLMENT_ID, level: 'Z9' }],
    [{ level: 'B1' }],
  ])('rejects invalid input %j with 400', async (body) => {
    setup(() => ({ data: null, error: null }));
    const res = await request(app).patch('/onboarding/diagnostic').set(AUTH).send(body);
    expect(res.status).toBe(400);
  });
});

describe('POST /onboarding/complete', () => {
  it('returns 409 NO_ENROLLMENT when the user has no active enrollment', async () => {
    const db = setup(() => ({ data: null, error: null, count: 0 }));
    const res = await request(app).post('/onboarding/complete').set(AUTH).send({ dailyGoalMinutes: 30, activeDays: [0, 1, 2] });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('NO_ENROLLMENT');
    expect(db.calls.filter((c) => c.op === 'update')).toHaveLength(0);
  });

  it('marks onboarding completed with the chosen schedule', async () => {
    const db = setup(() => ({ data: null, error: null, count: 1 }));
    const res = await request(app).post('/onboarding/complete').set(AUTH).send({ dailyGoalMinutes: 30, activeDays: [0, 1, 2, 3, 4] });
    expect(res.status).toBe(200);
    const [update] = db.calls.filter((c) => c.op === 'update');
    expect(update!.payload).toEqual({ daily_goal_minutes: 30, active_days: [0, 1, 2, 3, 4], onboarding_completed: true });
    expect(update!.filters).toMatchObject({ id: USER_ID });
  });

  it.each([
    [{ dailyGoalMinutes: 5, activeDays: [0] }],
    [{ dailyGoalMinutes: 30, activeDays: [] }],
    [{ dailyGoalMinutes: 30, activeDays: [7] }],
  ])('rejects invalid input %j with 400', async (body) => {
    setup(() => ({ data: null, error: null, count: 1 }));
    const res = await request(app).post('/onboarding/complete').set(AUTH).send(body);
    expect(res.status).toBe(400);
  });
});
