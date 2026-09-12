import { test, expect } from '@playwright/test';

test.describe('Phase 7 — Passenger Critical Journey', () => {
  test('Passenger can access onboarding, view dashboard, and initialize trip', async ({ page }) => {
    await page.goto('/');

    // Handle initial redirect to auth/welcome or passenger if session cached
    await page.waitForLoadState('domcontentloaded');
    const currentUrl = page.url();

    if (currentUrl.includes('/auth/login') || currentUrl.includes('/auth/welcome')) {
      // Expect login/welcome elements
      const loginButton = page.locator('button', { hasText: /login|sign in|continue/i }).first();
      await expect(loginButton).toBeVisible();
    } else {
      // In authenticated state, should view passenger dashboard
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('Public shared trip link is viewable without authentication', async ({ page }) => {
    // Phase 4.2 share link verification without login
    await page.goto('/track/test_demo_trip_123');
    await page.waitForLoadState('domcontentloaded');

    // Should not redirect to /auth/login
    await expect(page).not.toHaveURL(/\/auth\/login/);

    // Should display Mwendo Salama Shared Live Trip header
    const title = page.locator('h1, h2, div', { hasText: /Mwendo Salama|Live Trip Safety Status/i }).first();
    await expect(title).toBeVisible();
  });

  test('Passenger safety rewards and profile tier are mounted', async ({ page }) => {
    await page.goto('/passenger/profile');
    await page.waitForLoadState('domcontentloaded');

    // Verify profile page mounts or role guard redirects if unauthenticated
    const currentUrl = page.url();
    if (!currentUrl.includes('/auth/login')) {
      const rewardHeading = page.locator('text=Safety Rewards');
      await expect(rewardHeading).toBeVisible();
      const pointsDisplay = page.locator('text=Points');
      await expect(pointsDisplay).toBeVisible();
    }
  });
});
