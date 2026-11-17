import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/lib/supabase.js', () => ({
  getUserClient: vi.fn(),
  serviceClient: {},
  anonClient: {},
}));

import { createApp } from '../src/app.js';
import { getUserClient } from '../src/lib/supabase.js';
import { makeFakeDb, makeMockClient, type QueryCall } from './helpers/mockSupabase.js';

const mockGetUserClient = vi.mocked(getUserClient);
const app = createApp();
const AUTH = { Authorization: 'Bearer test-token' };
const ENROLLMENT_ID = '11111111-1111-1111-1111-111111111111';
const LESSON_ID = '22222222-2222-2222-2222-222222222222';
const LESSON_2 = '33333333-3333-3333-3333-333333333333';

interface SetupOpts {
  currentLevel?: string;
  /** null → enrollment not found / not owned by the caller. */
  enrollment?: { language_code: string; current_level: string } | null;
  /** null → lesson doesn't exist. */
  lesson?: { language_code: string; level: string } | null;
  levelLessonIds?: string[];
  completedLessonIds?: string[];
  /** INSERT ... ON CONFLICT DO NOTHING returned the row (first attempt). */
  inserted?: boolean;
  /** UPDATE ... WHERE completed = false matched (row existed, not completed). */
  flipped?: boolean;
  /** Compare-and-set level-up matched (false simulates losing a race). */
  advanced?: boolean;
}

function setup(opts: SetupOpts = {}) {
  const currentLevel = opts.currentLevel ?? 'A1';
  const enrollment = opts.enrollment === undefined
    ? { language_code: 'en', current_level: currentLevel }
    : opts.enrollment;
  const lesson = opts.lesson === undefined ? { language_code: 'en', level: currentLevel } : opts.lesson;
  const levelLessonIds = opts.levelLessonIds ?? [LESSON_ID];
  const completedLessonIds = opts.completedLessonIds ?? [LESSON_ID];

  const db = makeFakeDb((c: QueryCall) => {
    const ok = (data: unknown) => ({ data, error: null });
    switch (c.table) {
      case 'enrollments':
        if (c.op === 'select') return ok(enrollment ? { id: ENROLLMENT_ID, ...enrollment } : null);
        if (c.op === 'update') return ok(opts.advanced === false ? [] : [{ id: ENROLLMENT_ID }]);
        break;
      case 'lessons':
        if (c.filters['id']) return ok(lesson ? { id: LESSON_ID, ...lesson } : null);
        return ok(levelLessonIds.map((id) => ({ id })));
      case 'lesson_progress':
        if (c.op === 'upsert') return ok(opts.inserted === false ? [] : [{ id: 'progress-1' }]);
        if (c.op === 'update' && c.filters['completed'] === false) return ok(opts.flipped ? [{ id: 'progress-1' }] : []);
        if (c.op === 'update') return ok([]);
        return ok(completedLessonIds.map((id) => ({ lesson_id: id })));
      case 'vocabulary_reference':
        return ok([]);
    }
    return ok(null);
  });

  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const client = makeMockClient({ from: db.from as any, rpc });
  mockGetUserClient.mockReturnValue(client as any);

  return {
    rpc,
    calls: db.calls,
    writes: (table: string, op: QueryCall['op']) => db.calls.filter((c) => c.table === table && c.op === op),
  };
}

function complete(body: Record<string, unknown> = {}, lessonId = LESSON_ID) {
  return request(app)
    .post(`/lessons/${lessonId}/complete`)
    .set(AUTH)
    .send({ enrollmentId: ENROLLMENT_ID, score: 0.9, timeSpentSeconds: 120, ...body });
}

describe('POST /lessons/:lessonId/complete — validation and ownership', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post(`/lessons/${LESSON_ID}/complete`).send({});
    expect(res.status).toBe(401);
  });

  it('rejects a non-UUID lessonId with 400', async () => {
    setup();
    const res = await complete({}, 'not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('rejects an absurd timeSpentSeconds with 400', async () => {
    setup();
    const res = await complete({ timeSpentSeconds: 7 * 60 * 60 });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the enrollment isn't the caller's", async () => {
    const ctx = setup({ enrollment: null });
    const res = await complete();
    expect(res.status).toBe(404);
    expect(ctx.writes('lesson_progress', 'upsert')).toHaveLength(0);
    expect(ctx.rpc).not.toHaveBeenCalled();
  });

  it("returns 404 when the lesson doesn't exist", async () => {
    const ctx = setup({ lesson: null });
    const res = await complete();
    expect(res.status).toBe(404);
    expect(ctx.writes('lesson_progress', 'upsert')).toHaveLength(0);
  });

  it('returns 409 for a lesson from another language', async () => {
    const ctx = setup({ lesson: { language_code: 'fr', level: 'A1' } });
    const res = await complete();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LESSON_NOT_IN_CURRENT_LEVEL');
    expect(ctx.writes('lesson_progress', 'upsert')).toHaveLength(0);
    expect(ctx.rpc).not.toHaveBeenCalled();
  });

  it('returns 409 for a lesson from a different level (no early or back-filled XP)', async () => {
    const ctx = setup({ currentLevel: 'A1', lesson: { language_code: 'en', level: 'B2' } });
    const res = await complete();
    expect(res.status).toBe(409);
    expect(ctx.writes('enrollments', 'update')).toHaveLength(0);
  });
});

describe('POST /lessons/:lessonId/complete — XP is awarded once', () => {
  it('awards XP on the first completion', async () => {
    const ctx = setup({ inserted: true });
    const res = await complete({ score: 0.9 });
    expect(res.status).toBe(200);
    expect(res.body.data.xpEarned).toBe(90);
    expect(ctx.rpc).toHaveBeenCalledWith('increment_xp', { p_enrollment_id: ENROLLMENT_ID, p_xp: 90 });
    // The insert must be ON CONFLICT DO NOTHING + RETURNING, so only the
    // request that actually created the row sees it.
    const [upsert] = ctx.writes('lesson_progress', 'upsert');
    expect(upsert!.options).toMatchObject({ ignoreDuplicates: true });
    expect(upsert!.returning).toBe(true);
  });

  it('clamps a tampered score to 1 (max 100 XP)', async () => {
    setup({ inserted: true });
    const res = await complete({ score: 999 });
    expect(res.body.data.xpEarned).toBe(100);
  });

  it('awards no XP when the lesson was already completed (repeat or concurrent duplicate)', async () => {
    const ctx = setup({ inserted: false, flipped: false });
    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.body.data.xpEarned).toBe(0);
    expect(ctx.rpc).not.toHaveBeenCalledWith('increment_xp', expect.anything());
    // The latest attempt is still recorded.
    const updates = ctx.writes('lesson_progress', 'update');
    expect(updates.some((u) => u.filters['completed'] === undefined)).toBe(true);
  });

  it('awards XP when a not-yet-completed row is flipped to completed', async () => {
    const ctx = setup({ inserted: false, flipped: true });
    const res = await complete({ score: 0.5 });
    expect(res.body.data.xpEarned).toBe(50);
    const [flip] = ctx.writes('lesson_progress', 'update');
    expect(flip!.filters).toMatchObject({ completed: false });
    expect(ctx.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('POST /lessons/:lessonId/complete — level-up', () => {
  it('advances to the next level when this was the last incomplete lesson', async () => {
    const ctx = setup({
      currentLevel: 'A1',
      levelLessonIds: [LESSON_ID, LESSON_2],
      completedLessonIds: [LESSON_ID, LESSON_2],
    });

    const res = await complete();

    expect(res.status).toBe(200);
    expect(res.body.data.leveledUp).toBe('A2');
    const [levelUp] = ctx.writes('enrollments', 'update');
    expect(levelUp!.payload).toEqual({ current_level: 'A2' });
    // Compare-and-set: only advances from the level that was validated.
    expect(levelUp!.filters).toMatchObject({ id: ENROLLMENT_ID, current_level: 'A1' });
  });

  it('does not advance while other lessons at the level are still incomplete', async () => {
    const ctx = setup({
      levelLessonIds: [LESSON_ID, LESSON_2],
      completedLessonIds: [LESSON_ID],
    });

    const res = await complete();

    expect(res.status).toBe(200);
    expect(res.body.data.leveledUp).toBeNull();
    expect(ctx.writes('enrollments', 'update')).toHaveLength(0);
  });

  it('does not report a level-up when a concurrent request already advanced it', async () => {
    setup({ advanced: false });
    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.body.data.leveledUp).toBeNull();
  });

  it('advances C2 to NATIVE', async () => {
    const res = await (setup({ currentLevel: 'C2' }), complete());
    expect(res.body.data.leveledUp).toBe('NATIVE');
  });

  it('does not attempt to advance past NATIVE', async () => {
    const ctx = setup({ currentLevel: 'NATIVE' });
    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.body.data.leveledUp).toBeNull();
    expect(ctx.writes('enrollments', 'update')).toHaveLength(0);
  });
});
