import { http, HttpResponse } from 'msw';

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? 'http://localhost:54321';

export const supabaseHandlers = [
  // activity_logs GET (daily totals)
  http.get(`${SUPABASE_URL}/rest/v1/activity_logs`, ({ request }) => {
    const url = new URL(request.url);
    const select = url.searchParams.get('select') ?? '';

    if (select.includes('duration_minutes')) {
      return HttpResponse.json([
        { duration_minutes: 60 },
        { duration_minutes: 45 },
      ]);
    }

    return HttpResponse.json([
      {
        id: 'log-1',
        user_id: 'user-123',
        enrollment_id: 'enroll-123',
        activity_type: 'lesson',
        duration_minutes: 60,
        xp_earned: 600,
        created_at: new Date().toISOString(),
      },
    ]);
  }),

  // activity_logs POST
  http.post(`${SUPABASE_URL}/rest/v1/activity_logs`, () => {
    return HttpResponse.json({ id: 'log-new' }, { status: 201 });
  }),

  // enrollments GET
  http.get(`${SUPABASE_URL}/rest/v1/enrollments`, () => {
    return HttpResponse.json([
      {
        id: 'enroll-123',
        user_id: 'user-123',
        language_code: 'en',
        current_level: 'A1',
        active: true,
        total_study_hours: 100,
        daily_goal_minutes: 30,
        started_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString(),
        diagnostic_completed: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  }),

  // srs_items GET
  http.get(`${SUPABASE_URL}/rest/v1/srs_items`, () => {
    return HttpResponse.json([
      {
        id: 'item-1',
        enrollment_id: 'enroll-123',
        ease_factor: 2.5,
        interval_days: 1,
        repetitions: 0,
        next_review_at: new Date().toISOString(),
        vocabulary_reference: {
          word: 'hello',
          translation: 'hola',
          example_sentence: 'Hello world',
          audio_url: null,
          image_url: null,
          pronunciation: 'həˈloʊ',
        },
      },
    ]);
  }),

  // srs_items PATCH
  http.patch(`${SUPABASE_URL}/rest/v1/srs_items`, () => {
    return HttpResponse.json(null, { status: 204 });
  }),

  // RPC update_streak
  http.post(`${SUPABASE_URL}/rest/v1/rpc/update_streak`, () => {
    return HttpResponse.json(null);
  }),
];
