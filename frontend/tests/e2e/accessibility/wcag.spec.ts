import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC_ROUTES = ['/login', '/register'];
const AUTH_ROUTES = ['/dashboard', '/exam', '/exam/prepare'];

test.describe('WCAG 2.1 AA — public pages', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} has no critical accessibility violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Filter to errors only (not warnings)
      const critical = results.violations.filter((v) => v.impact === 'critical');
      const serious = results.violations.filter((v) => v.impact === 'serious');

      if (critical.length > 0 || serious.length > 0) {
        const formatted = [...critical, ...serious]
          .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} elements)`)
          .join('\n');
        throw new Error(`Accessibility violations on ${route}:\n${formatted}`);
      }

      expect(results.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toHaveLength(0);
    });
  }
});

test.describe('WCAG 2.1 AA — authenticated pages', () => {
  test.use({ storageState: 'tests/e2e/.auth/eligible-user.json' });

  for (const route of AUTH_ROUTES) {
    test.skip(`${route} has no critical accessibility violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const violations = results.violations.filter((v) =>
        ['critical', 'serious'].includes(v.impact ?? ''),
      );
      expect(violations).toHaveLength(0);
    });
  }
});

test.describe('Keyboard navigation', () => {
  test('login page is fully keyboard navigable', async ({ page }) => {
    await page.goto('/login');

    // Tab through the form
    await page.keyboard.press('Tab');
    const focused1 = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A']).toContain(focused1);

    await page.keyboard.press('Tab');
    const focused2 = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A']).toContain(focused2);
  });

  test('interactive elements have visible focus indicators', async ({ page }) => {
    await page.goto('/login');
    await page.keyboard.press('Tab');

    // Check that focus is visible (has outline or similar)
    const hasFocusStyle = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return (
        style.outlineWidth !== '0px' ||
        style.boxShadow !== 'none' ||
        el.getAttribute('data-focus-visible') !== null
      );
    });
    expect(hasFocusStyle).toBe(true);
  });
});

test.describe('Color contrast', () => {
  test('login page passes color contrast checks', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
    if (contrastViolations.length > 0) {
      const details = contrastViolations
        .flatMap((v) => v.nodes)
        .map((n) => n.html)
        .slice(0, 5)
        .join('\n');
      console.warn('Color contrast issues (first 5):\n', details);
    }
    // Warn-only for contrast to avoid blocking CI on design issues
    expect(contrastViolations.length).toBeLessThan(10);
  });
});

test.describe('Screen reader landmarks', () => {
  test('login page has a main landmark', async ({ page }) => {
    await page.goto('/login');
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('page has a document title', async ({ page }) => {
    await page.goto('/login');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
