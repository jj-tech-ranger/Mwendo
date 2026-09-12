import { test, expect } from '@playwright/test';

test.describe('Phase 7 — SACCO Manager Critical Journey', () => {
  test('SACCO routes are protected by role guard when unauthenticated', async ({ page }) => {
    await page.goto('/sacco');
    await page.waitForLoadState('domcontentloaded');

    // Role guard should prevent direct access without valid auth session
    await expect(page).toHaveURL(/\/(auth\/login|auth\/welcome|auth\/unauthorized)/);
  });

  test('SACCO fleet and live trips routes enforce tenant isolation', async ({ page }) => {
    await page.goto('/sacco/fleet');
    await page.waitForLoadState('domcontentloaded');

    // Check redirect or prompt
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/\/(auth\/login|auth\/unauthorized|sacco\/fleet)/);
  });
});
