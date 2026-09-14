import { test, expect } from '@playwright/test';

test.describe('Exam flow (authenticated)', () => {
  // These tests require a logged-in user with sufficient study hours.
  // Run: npx playwright test --project=chromium tests/e2e/critical-paths/exam-flow.spec.ts
  // after seeding a test user via: npm run seed:test-user

  test.use({ storageState: 'tests/e2e/.auth/eligible-user.json' });

  test.skip('exam page shows current level and hours progress', async ({ page }) => {
    await page.goto('/exam');
    await expect(page.getByText(/nivel actual/i)).toBeVisible();
    await expect(page.getByText(/horas de estudio/i)).toBeVisible();
  });

  test.skip('eligible user sees "Comenzar examen" button', async ({ page }) => {
    await page.goto('/exam');
    const startBtn = page.getByRole('link', { name: /comenzar examen/i });
    await expect(startBtn).toBeVisible();
    await expect(startBtn).not.toBeDisabled();
  });

  test.skip('preparation page renders checklist', async ({ page }) => {
    await page.goto('/exam/prepare');
    await expect(page.getByText(/preparación del examen/i)).toBeVisible();
    const checkboxes = page.getByRole('button').filter({ hasText: /cámara|micrófono|iluminación/i });
    await expect(checkboxes.first()).toBeVisible();
  });

  test.skip('start button disabled until all requirements checked', async ({ page }) => {
    await page.goto('/exam/prepare');
    const startBtn = page.getByRole('button', { name: /iniciar grabación/i });
    await expect(startBtn).toBeDisabled();
  });

  test.skip('checking all requirements enables the start button', async ({ page }) => {
    await page.goto('/exam/prepare');

    const requirementBtns = page.getByRole('button').filter({
      hasText: /cámara|micrófono|iluminación|tranquilo|tiempo/i,
    });
    const count = await requirementBtns.count();

    for (let i = 0; i < count; i++) {
      await requirementBtns.nth(i).click();
    }

    const startBtn = page.getByRole('button', { name: /iniciar grabación/i });
    await expect(startBtn).not.toBeDisabled();
  });

  test.skip('results page renders score radar chart', async ({ page }) => {
    // Navigate to a completed attempt
    await page.goto('/exam/results/test-attempt-id');
    await expect(page.getByText(/resultado/i)).toBeVisible();
  });
});

test.describe('Exam page (ineligible user)', () => {
  test.use({ storageState: 'tests/e2e/.auth/ineligible-user.json' });

  test.skip('ineligible user sees requirements pending message', async ({ page }) => {
    await page.goto('/exam');
    await expect(page.getByText(/requisitos pendientes/i)).toBeVisible();
  });

  test.skip('start button is disabled for ineligible user', async ({ page }) => {
    await page.goto('/exam');
    const startBtn = page.getByRole('button', { name: /requisitos/i });
    await expect(startBtn).toBeDisabled();
  });
});
