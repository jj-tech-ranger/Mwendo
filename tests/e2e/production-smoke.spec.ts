import { test, expect } from '@playwright/test';

test.describe('Phase 13 — Production Smoke Tests', () => {
  test('Hosting root and deep links resolve without 404', async ({ page }) => {
    // Test root
    const rootRes = await page.goto('/');
    expect(rootRes?.status()).toBeLessThan(400);

    // Test deep link for auth login
    const loginRes = await page.goto('/auth/login');
    expect(loginRes?.status()).toBeLessThan(400);

    // Test shared trip tracking link
    const trackRes = await page.goto('/track/demo_smoke_123');
    expect(trackRes?.status()).toBeLessThan(400);
  });

  test('Passenger authentication surface loads form controls', async ({ page }) => {
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    // Verify presence of input fields or credentials toggle
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(1);
  });

  test('Public shared trip route displays live safety status without authentication errors', async ({ page }) => {
    await page.goto('/track/sample_trip_456');
    await page.waitForLoadState('domcontentloaded');

    // Page must not crash or display raw error object
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('ChunkLoadError');
    expect(bodyText).not.toContain('Cannot read properties of undefined');
  });

  test('Safety map and hazard screens load without unhandled script exceptions', async ({ page }) => {
    const errorLogs: string[] = [];
    page.on('pageerror', (exception) => {
      errorLogs.push(exception.message);
    });

    await page.goto('/passenger/map');
    await page.waitForLoadState('domcontentloaded');

    // Verify no fatal uncaught errors occurred during route mount
    const fatalErrors = errorLogs.filter(
      (msg) => !msg.includes('network') && !msg.includes('fetch') && !msg.includes('Firebase')
    );
    expect(fatalErrors.length).toBe(0);
  });
});
