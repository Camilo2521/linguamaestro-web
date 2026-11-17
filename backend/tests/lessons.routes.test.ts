import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/lib/supabase.js', () => ({
  getUserClient: vi.fn(),
  serviceClient: {},
  anonClient: {},
}));

import { createApp } from '../src/app.js';
import { getUserClient } from '../src/lib/supabase.js';
import { makeMockClient, makeQueryBuilder } from './helpers/mockSupabase.js';

const mockGetUserClient = vi.mocked(getUserClient);
const app = createApp();
const AUTH = { Authorization: 'Bearer test-token' };
const ENROLLMENT_ID = '11111111-1111-1111-1111-111111111111';
const LESSON_ID = '22222222-2222-2222-2222-222222222222';

interface SetupOpts {
  currentLevel?: string;
  levelLessonIds?: string[];
  completedLessonIds?: string[];
}

/**
 * The lesson-complete route touches lesson_progress three separate times
 * (existing-completion check, upsert, then the completed-count check for
 * level-up) and enrollments twice (level lookup, then the level-up write
 * itself) — each call needs its own canned response, so the mock dispatches
 * by call order per table instead of one fixed response per table.
 */
function setup(opts: SetupOpts = {}) {
  const currentLevel = opts.currentLevel ?? 'A1';
  const levelLessonIds = opts.levelLessonIds ?? [LESSON_ID];
  const completedLessonIds = opts.completedLessonIds ?? [LESSON_ID];

  const callCounts: Record<string, number> = {};
  let enrollmentUpdatePayload: any = null;

  const client = makeMockClient({
    from: (table: string) => {
      callCounts[table] = (callCounts[table] ?? 0) + 1;
      const n = callCounts[table];

      if (table === 'lesson_progress') {
        if (n === 1) return makeQueryBuilder({ data: null, error: null }); // existing-completion check
        if (n === 2) return makeQueryBuilder({ data: null, error: null }); // upsert
        // completed-count check
        return makeQueryBuilder({ data: completedLessonIds.map((id) => ({ lesson_id: id })), error: null });
      }
      if (table === 'enrollments') {
        if (n === 1) {
          return makeQueryBuilder({ data: { id: ENROLLMENT_ID, language_code: 'en', current_level: currentLevel }, error: null });
        }
        // level-up write
        const builder = makeQueryBuilder({ data: null, error: null });
        const originalUpdate = builder['update'] as ReturnType<typeof vi.fn>;
        originalUpdate.mockImplementation((payload: any) => {
          enrollmentUpdatePayload = payload;
          return builder;
        });
        return builder;
      }
      if (table === 'lessons') {
        if (n === 1) return makeQueryBuilder({ data: { language_code: 'en', level: currentLevel }, error: null }); // vocab-seed lessonMeta
        return makeQueryBuilder({ data: levelLessonIds.map((id) => ({ id })), error: null }); // level's lesson list
      }
      if (table === 'vocabulary_reference') return makeQueryBuilder({ data: [], error: null });
      if (table === 'srs_items') return makeQueryBuilder({ data: null, error: null });
      if (table === 'activity_logs') return makeQueryBuilder({ data: null, error: null });
      return makeQueryBuilder({ data: null, error: null });
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  mockGetUserClient.mockReturnValue(client as any);
  return { client, getEnrollmentUpdate: () => enrollmentUpdatePayload };
}

describe('POST /lessons/:lessonId/complete — level-up', () => {
  it('advances to the next level when this was the last incomplete lesson', async () => {
    const ctx = setup({
      currentLevel: 'A1',
      levelLessonIds: [LESSON_ID, 'lesson-2'],
      completedLessonIds: [LESSON_ID, 'lesson-2'],
    });

    const res = await request(app).post(`/lessons/${LESSON_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      score: 0.9,
      timeSpentSeconds: 120,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.leveledUp).toBe('A2');
    expect(ctx.getEnrollmentUpdate()).toEqual({ current_level: 'A2' });
  });

  it('does not advance while other lessons at the level are still incomplete', async () => {
    const ctx = setup({
      currentLevel: 'A1',
      levelLessonIds: [LESSON_ID, 'lesson-2'],
      completedLessonIds: [LESSON_ID], // lesson-2 still pending
    });

    const res = await request(app).post(`/lessons/${LESSON_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      score: 0.9,
      timeSpentSeconds: 120,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.leveledUp).toBeNull();
    expect(ctx.getEnrollmentUpdate()).toBeNull();
  });

  it('does not attempt to advance past NATIVE', async () => {
    const ctx = setup({
      currentLevel: 'NATIVE',
      levelLessonIds: [LESSON_ID],
      completedLessonIds: [LESSON_ID],
    });

    const res = await request(app).post(`/lessons/${LESSON_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      score: 0.9,
      timeSpentSeconds: 120,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.leveledUp).toBeNull();
    expect(ctx.getEnrollmentUpdate()).toBeNull();
  });
});
