import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/lib/supabase.js', () => ({
  getUserClient: vi.fn(),
  getServiceClient: () => ({}),
  anonClient: {},
}));

import { createApp } from '../src/app.js';
import { getUserClient } from '../src/lib/supabase.js';
import { makeMockClient, makeQueryBuilder } from './helpers/mockSupabase.js';

const mockGetUserClient = vi.mocked(getUserClient);
const app = createApp();
const AUTH = { Authorization: 'Bearer test-token' };
const ENROLLMENT_ID = '11111111-1111-1111-1111-111111111111';
const PROMPT_ID = '22222222-2222-2222-2222-222222222222';

interface SetupOpts {
  prompt?: Record<string, unknown> | null;
  enrollmentFound?: boolean;
  todayLogs?: { duration_minutes: number }[];
  insertError?: unknown;
  onInsert?: (row: any) => void;
}

function setup(opts: SetupOpts = {}) {
  const prompt = 'prompt' in opts
    ? opts.prompt
    : { id: PROMPT_ID, mode: 'speaking', language_code: 'en', level: 'A1', target_words: null };
  const enrollmentFound = opts.enrollmentFound ?? true;
  const todayLogs = opts.todayLogs ?? [];

  const client = makeMockClient({
    from: (table: string) => {
      if (table === 'practice_prompts') {
        return makeQueryBuilder({ data: prompt, error: null });
      }
      if (table === 'enrollments') {
        return makeQueryBuilder({ data: enrollmentFound ? { id: ENROLLMENT_ID } : null, error: null });
      }
      if (table === 'activity_logs') {
        const builder = makeQueryBuilder(
          opts.insertError ? { data: null, error: opts.insertError } : { data: todayLogs, error: null },
        );
        if (opts.onInsert) {
          const originalInsert = builder['insert'] as ReturnType<typeof vi.fn>;
          originalInsert.mockImplementation((row: any) => {
            opts.onInsert!(row);
            return builder;
          });
        }
        return builder;
      }
      return makeQueryBuilder();
    },
  });
  mockGetUserClient.mockReturnValue(client as any);
  return client;
}

describe('GET /practice — authentication', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/practice?languageCode=en&level=A1&mode=speaking');
    expect(res.status).toBe(401);
  });
});

describe('GET /practice — validation', () => {
  it('rejects an unsupported mode', async () => {
    setup();
    const res = await request(app).get('/practice?languageCode=en&level=A1&mode=singing').set(AUTH);
    expect(res.status).toBe(400);
  });
});

describe('POST /practice/:promptId/complete — not found', () => {
  it('404s when the prompt does not exist', async () => {
    setup({ prompt: null });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 60,
    });
    expect(res.status).toBe(404);
  });

  it('404s when the enrollment is not the caller\'s', async () => {
    setup({ enrollmentFound: false });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 60,
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /practice/:promptId/complete — oral modes (speaking/shadowing/debate)', () => {
  it('rejects a session shorter than the 20-second floor', async () => {
    setup();
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 10,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('20');
  });

  it('accepts a session at exactly the 20-second floor and awards XP for the rounded minute', async () => {
    let insertedRow: any;
    setup({ onInsert: (row) => { insertedRow = row; } });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 20,
    });
    expect(res.status).toBe(200);
    expect(insertedRow.duration_minutes).toBe(1);
    expect(insertedRow.xp_earned).toBe(12); // 1 min * PRACTICE_XP_PER_MINUTE
    expect(insertedRow.activity_type).toBe('speaking');
  });

  it('maps shadowing mode to the "listening" activity type', async () => {
    let insertedRow: any;
    setup({
      prompt: { id: PROMPT_ID, mode: 'shadowing', language_code: 'en', level: 'A1', target_words: null },
      onInsert: (row) => { insertedRow = row; },
    });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 90,
    });
    expect(res.status).toBe(200);
    expect(insertedRow.activity_type).toBe('listening');
  });

  it('maps debate mode to the "speaking" activity type', async () => {
    let insertedRow: any;
    setup({
      prompt: { id: PROMPT_ID, mode: 'debate', language_code: 'en', level: 'B1', target_words: null },
      onInsert: (row) => { insertedRow = row; },
    });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 90,
    });
    expect(res.status).toBe(200);
    expect(insertedRow.activity_type).toBe('speaking');
  });

  it('records the prompt id and mode in metadata', async () => {
    let insertedRow: any;
    setup({ onInsert: (row) => { insertedRow = row; } });
    await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 60,
    });
    expect(insertedRow.metadata.prompt_id).toBe(PROMPT_ID);
    expect(insertedRow.metadata.mode).toBe('speaking');
  });
});

describe('POST /practice/:promptId/complete — writing mode', () => {
  const writingPrompt = { id: PROMPT_ID, mode: 'writing', language_code: 'en', level: 'B1', target_words: 100 };

  it('rejects a word count below half the target', async () => {
    setup({ prompt: writingPrompt });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 300,
      wordCount: 40, // half of 100 is 50
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('50');
  });

  it('accepts a word count at exactly half the target, ignoring the oral 20s floor', async () => {
    let insertedRow: any;
    setup({ prompt: writingPrompt, onInsert: (row) => { insertedRow = row; } });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 5, // well under 20s — writing shouldn't care
      wordCount: 50,
    });
    expect(res.status).toBe(200);
    expect(insertedRow.activity_type).toBe('writing');
    expect(insertedRow.metadata.word_count).toBe(50);
  });
});

describe('POST /practice/:promptId/complete — multiple_choice mode', () => {
  const mcPrompt = {
    id: PROMPT_ID, mode: 'multiple_choice', language_code: 'en', level: 'A2', target_words: null,
    correct_answer: 'went',
  };

  it('rejects when no answer is provided', async () => {
    setup({ prompt: mcPrompt });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 5,
    });
    expect(res.status).toBe(400);
  });

  it('awards XP and reports correct:true for an exact match, ignoring the oral floor', async () => {
    let insertedRow: any;
    setup({ prompt: mcPrompt, onInsert: (row) => { insertedRow = row; } });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 4, // well under the 20s oral floor — shouldn't matter here
      answer: 'went',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(true);
    expect(insertedRow.xp_earned).toBe(12);
    expect(insertedRow.metadata.correct).toBe(true);
  });

  it('logs the attempt with zero XP and correct:false for a wrong answer', async () => {
    let insertedRow: any;
    setup({ prompt: mcPrompt, onInsert: (row) => { insertedRow = row; } });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 4,
      answer: 'goed',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(false);
    expect(insertedRow.xp_earned).toBe(0);
  });
});

describe('POST /practice/:promptId/complete — fill_blank mode', () => {
  const fillBlankPrompt = {
    id: PROMPT_ID, mode: 'fill_blank', language_code: 'en', level: 'A2', target_words: null,
    correct_answer: 'beautiful',
  };

  it('accepts a fuzzy (near-exact, case-insensitive) match', async () => {
    let insertedRow: any;
    setup({ prompt: fillBlankPrompt, onInsert: (row) => { insertedRow = row; } });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 3,
      answer: 'Beautiful',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(true);
    expect(insertedRow.xp_earned).toBe(12);
  });

  it('rejects an unrelated answer as incorrect rather than erroring', async () => {
    setup({ prompt: fillBlankPrompt });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 3,
      answer: 'xyz',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(false);
  });

  it('rejects an empty answer with 400', async () => {
    setup({ prompt: fillBlankPrompt });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 3,
      answer: '   ',
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /practice/:promptId/complete — pronunciation mode', () => {
  const pronunciationPrompt = {
    id: PROMPT_ID, mode: 'pronunciation', language_code: 'en', level: 'A1', target_words: null,
    reference_text: 'Good morning, how are you?',
  };

  it('rejects a session shorter than the pronunciation floor', async () => {
    setup({ prompt: pronunciationPrompt });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 1,
      transcript: 'Good morning how are you',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a missing/empty transcript', async () => {
    setup({ prompt: pronunciationPrompt });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 5,
    });
    expect(res.status).toBe(400);
  });

  it('accepts a close transcript (tolerant of missing punctuation) as correct', async () => {
    let insertedRow: any;
    setup({ prompt: pronunciationPrompt, onInsert: (row) => { insertedRow = row; } });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 5,
      transcript: 'good morning how are you', // speech recognition drops punctuation
    });
    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(true);
    expect(insertedRow.activity_type).toBe('speaking');
  });

  it('reports correct:false for a transcript that does not resemble the target', async () => {
    setup({ prompt: pronunciationPrompt });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 5,
      transcript: 'completely unrelated words here',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(false);
  });
});

describe('POST /practice/:promptId/complete — daily cap enforcement', () => {
  it('blocks when adding the session would exceed the daily cap', async () => {
    setup({ todayLogs: [{ duration_minutes: 359 }] });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 120, // rounds to 2 minutes, 359+2 > 360
    });
    expect(res.status).toBe(429);
    expect(res.body.blocked).toBe(true);
  });
});

describe('POST /practice/:promptId/complete — database error handling', () => {
  it('returns an error when the insert fails', async () => {
    setup({ insertError: { message: 'insert failed' } });
    const res = await request(app).post(`/practice/${PROMPT_ID}/complete`).set(AUTH).send({
      enrollmentId: ENROLLMENT_ID,
      durationSeconds: 60,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('insert failed');
  });
});
