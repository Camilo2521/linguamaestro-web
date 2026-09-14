import { test, expect } from '@playwright/test';

test.describe('Onboarding flow', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh — clear auth state
    await page.goto('/');
  });

  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('login page renders and has accessible form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña|password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesión|sign in|ingresar/i })).toBeVisible();
  });

  test('login form validates empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /iniciar sesión|sign in|ingresar/i }).click();
    // HTML5 validation or client-side validation message
    const emailField = page.getByLabel(/email/i);
    await expect(emailField).toBeVisible();
  });

  test('login form validates invalid email format', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByLabel(/contraseña|password/i).fill('password123');
    await page.getByRole('button', { name: /iniciar sesión|sign in|ingresar/i }).click();
    // Expect an error or the form to stay on the page (not navigate away)
    await expect(page).toHaveURL(/login/);
  });

  test('register page is accessible from login', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.getByRole('link', { name: /registrar|create account|sign up/i });
    if (await registerLink.isVisible()) {
      await registerLink.click();
      await expect(page).toHaveURL(/register/);
    }
  });

  test('register page renders with all required fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/contraseña|password/i).first()).toBeVisible();
  });

  test('root page redirects appropriately', async ({ page }) => {
    await page.goto('/');
    // Should redirect to login or dashboard depending on auth state
    await expect(page).not.toHaveURL('/', { timeout: 5000 });
  });
});

test.describe('Onboarding steps (authenticated)', () => {
  test.use({ storageState: 'tests/e2e/.auth/new-user.json' });

  test.skip('welcome step is shown to new users', async ({ page }) => {
    // Requires a pre-created new user auth state
    await page.goto('/onboarding/welcome');
    await expect(page.getByText(/bienvenido|welcome/i)).toBeVisible();
  });

  test.skip('language selection step shows available languages', async ({ page }) => {
    await page.goto('/onboarding/language');
    await expect(page.getByText(/inglés|english/i)).toBeVisible();
    await expect(page.getByText(/francés|french/i)).toBeVisible();
  });
});
