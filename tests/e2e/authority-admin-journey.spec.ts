import { test, expect } from '@playwright/test';

test.describe('Phase 7 — Authority and Admin Critical Journey', () => {
  test('Authority compliance route is role-gated against unauthenticated visitors', async ({ page }) => {
    await page.goto('/authority/compliance');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/(auth\/login|auth\/welcome|auth\/unauthorized)/);
  });

  test('Admin dashboard is strictly role-gated', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/(auth\/login|auth\/welcome|auth\/unauthorized)/);
  });

  test('Authority black spots screen requires authority role', async ({ page }) => {
    await page.goto('/authority/blackspots');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/(auth\/login|auth\/welcome|auth\/unauthorized)/);
  });
});
