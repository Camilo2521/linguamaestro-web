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

describe('GET /exam/eligibility — authentication', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get(`/exam/eligibility?enrollmentId=${ENROLLMENT_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when the token does not resolve to a user', async () => {
    mockGetUserClient.mockReturnValue(makeMockClient({ userId: null }) as any);
    const res = await request(app).get(`/exam/eligibility?enrollmentId=${ENROLLMENT_ID}`).set(AUTH);
    expect(res.status).toBe(401);
  });
});

describe('GET /exam/eligibility — eligibility logic', () => {
  it('returns eligible=true when all conditions are met', async () => {
    const client = makeMockClient({
      from: (table: string) => {
        if (table === 'enrollments') {
          return makeQueryBuilder({
            data: {
              current_level: 'A1',
              total_study_hours: 95,
              started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString(),
              exam_attempts_count: 0,
            },
            error: null,
          });
        }
        // exam_attempts (last attempt lookup) — none yet
        return makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
      },
    });
    mockGetUserClient.mockReturnValue(client as any);

    const res = await request(app).get(`/exam/eligibility?enrollmentId=${ENROLLMENT_ID}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data.eligible).toBe(true);
    expect(res.body.data.reasons).toHaveLength(0);
  });

  it('returns eligible=false when hours studied are insufficient', async () => {
    const client = makeMockClient({
      from: (table: string) => {
        if (table === 'enrollments') {
          return makeQueryBuilder({
            data: {
              current_level: 'A1',
              total_study_hours: 40, // < 90 required
              started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString(),
              exam_attempts_count: 0,
            },
            error: null,
          });
        }
        return makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
      },
    });
    mockGetUserClient.mockReturnValue(client as any);

    const res = await request(app).get(`/exam/eligibility?enrollmentId=${ENROLLMENT_ID}`).set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data.eligible).toBe(false);
    expect(res.body.data.reasons.some((r: string) => r.includes('90h'))).toBe(true);
  });

  it('returns 404 when the enrollment does not exist', async () => {
    const client = makeMockClient({ from: () => makeQueryBuilder({ data: null, error: null }) });
    mockGetUserClient.mockReturnValue(client as any);

    const res = await request(app).get(`/exam/eligibility?enrollmentId=${ENROLLMENT_ID}`).set(AUTH);
    expect(res.status).toBe(404);
  });
});

describe('POST /exam/attempts', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).post('/exam/attempts').send({ enrollmentId: ENROLLMENT_ID });
    expect(res.status).toBe(401);
  });

  it('returns an attemptId on success when the enrollment is eligible', async () => {
    // POST /attempts re-checks eligibility server-side (not just an
    // informational GET /eligibility) — the mock must satisfy it: enough
    // hours/months studied, no attempt in the cooldown window.
    const client = makeMockClient({
      from: (table: string) => {
        if (table === 'enrollments') {
          return makeQueryBuilder({
            data: {
              current_level: 'A1',
              total_study_hours: 95,
              started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString(),
              exam_attempts_count: 0,
            },
            error: null,
          });
        }
        if (table === 'exam_attempts') {
          // First call inside loadEligibility (last-attempt lookup): none yet.
          // Second call is the actual insert — makeQueryBuilder's `insert`
          // is chainable and resolves via the same `data`, so give it the
          // created row shape the insert chain expects.
          return makeQueryBuilder({ data: { id: 'attempt-abc' }, error: null });
        }
        return makeQueryBuilder({ data: null, error: null });
      },
    });
    mockGetUserClient.mockReturnValue(client as any);

    const res = await request(app).post('/exam/attempts').set(AUTH).send({ enrollmentId: ENROLLMENT_ID });
    expect(res.status).toBe(200);
    expect(res.body.data.attemptId).toBe('attempt-abc');
  });

  it('rejects with 403 when the enrollment is not eligible', async () => {
    const client = makeMockClient({
      from: (table: string) => {
        if (table === 'enrollments') {
          return makeQueryBuilder({
            data: {
              current_level: 'A1',
              total_study_hours: 10, // well under the 90h requirement
              started_at: new Date().toISOString(),
              exam_attempts_count: 0,
            },
            error: null,
          });
        }
        return makeQueryBuilder({ data: null, error: { code: 'PGRST116' } });
      },
    });
    mockGetUserClient.mockReturnValue(client as any);

    const res = await request(app).post('/exam/attempts').set(AUTH).send({ enrollmentId: ENROLLMENT_ID });
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('rejects a non-UUID enrollmentId', async () => {
    mockGetUserClient.mockReturnValue(makeMockClient() as any);
    const res = await request(app).post('/exam/attempts').set(AUTH).send({ enrollmentId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('rejects an enrollmentId that does not belong to the caller (cross-tenant hijack)', async () => {
    // Regression test: a user could otherwise create an exam_attempts row
    // carrying their own user_id but someone ELSE's enrollment_id, and a
    // later "pass" would advance that OTHER account's CEFR level via the
    // service-role client. loadEligibility's enrollment lookup is scoped to
    // `.eq('user_id', userId)`, so a foreign enrollment_id must resolve to
    // "not found" here, not to that other account's real data.
    const client = makeMockClient({
      from: () => makeQueryBuilder({ data: null, error: null }),
    });
    mockGetUserClient.mockReturnValue(client as any);

    const res = await request(app).post('/exam/attempts').set(AUTH).send({ enrollmentId: ENROLLMENT_ID });
    expect(res.status).toBe(404);
  });
});

describe('GET /exam/attempts/:attemptId — ownership', () => {
  it('returns 404 when the attempt does not belong to the caller (RLS-scoped query finds nothing)', async () => {
    const client = makeMockClient({ from: () => makeQueryBuilder({ data: null, error: { message: 'not found' } }) });
    mockGetUserClient.mockReturnValue(client as any);

    const res = await request(app).get('/exam/attempts/attempt-1').set(AUTH);
    expect(res.status).toBe(404);
  });
});
