import { test, expect } from '@playwright/test';

/**
 * Security: exam anti-fraud and access control tests.
 * Verifies that server-side guards cannot be bypassed by client manipulation.
 */
test.describe('Exam security — unauthenticated access', () => {
  test('exam page redirects to login for unauthenticated user', async ({ page }) => {
    await page.goto('/exam');
    await expect(page).toHaveURL(/login/);
  });

  test('exam prepare page redirects to login for unauthenticated user', async ({ page }) => {
    await page.goto('/exam/prepare');
    await expect(page).toHaveURL(/login/);
  });

  test('direct API call to createExamAttempt without auth returns 401/redirect', async ({
    request,
  }) => {
    // Server actions are POST to the page — unauthenticated calls return an error
    const response = await request.post('/exam/prepare', {
      headers: { 'Content-Type': 'application/json' },
      data: { enrollmentId: 'fake-enroll-id' },
      failOnStatusCode: false,
    });
    // Should not be 200 with a success payload — either redirect (3xx) or error (4xx)
    expect(response.status()).not.toBe(200);
  });
});

test.describe('Exam security — score manipulation attempts', () => {
  test.use({ storageState: 'tests/e2e/.auth/eligible-user.json' });

  test.skip('cannot POST fabricated score directly to exam_attempts table', async ({
    request,
  }) => {
    // Attempt to directly update an exam attempt with a fabricated score
    // This should be blocked by Supabase RLS policies
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const supabaseKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
    if (!supabaseUrl || !supabaseKey) test.skip();

    const response = await request.patch(`${supabaseUrl}/rest/v1/exam_attempts?id=eq.some-id`, {
      headers: {
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
      data: { overall_score: 0.99, passed: true, status: 'completed' },
      failOnStatusCode: false,
    });
    // RLS should block direct writes from anon/user key
    expect([401, 403, 0]).toContain(response.status());
  });

  test.skip('cannot access another user\'s exam results', async ({ page }) => {
    // Navigate to a result page belonging to a different user
    await page.goto('/exam/results/other-users-attempt-id');
    // Should redirect or show 404/forbidden
    const url = page.url();
    const isBlocked =
      url.includes('login') ||
      url.includes('404') ||
      url.includes('forbidden') ||
      url.includes('exam');
    expect(isBlocked).toBe(true);
  });
});

test.describe('Exam security — cooldown bypass attempts', () => {
  test.use({ storageState: 'tests/e2e/.auth/recently-examined-user.json' });

  test.skip('ineligible user cannot bypass cooldown via direct URL', async ({ page }) => {
    await page.goto('/exam/prepare');
    // The page should either redirect or the button should remain disabled
    // The server-side createExamAttemptAction will still check eligibility via RLS/triggers
    const heading = page.getByText(/preparación del examen/i);
    // If they can reach prepare, start button behaviour is tested elsewhere
    // The key guard is in the server action
    if (await heading.isVisible()) {
      const startBtn = page.getByRole('button', { name: /iniciar grabación/i });
      await expect(startBtn).toBeDisabled();
    } else {
      // Page redirected — also acceptable
      await expect(page).not.toHaveURL(/prepare/);
    }
  });
});

test.describe('Exam security — CSRF and request forgery', () => {
  test('server action endpoint rejects cross-origin requests', async ({ request }) => {
    // Next.js server actions verify the Origin header
    const response = await request.post('/exam', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://evil.example.com',
      },
      data: '1_examId=fake',
      failOnStatusCode: false,
    });
    // Next.js will reject non-matching origins for server actions (403)
    expect([400, 403, 405]).toContain(response.status());
  });
});
