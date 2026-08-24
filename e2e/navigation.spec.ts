import { test, expect } from '@playwright/test';

interface TestWindow extends Window {
  __TEST_AUTH_OVERRIDE__?: boolean;
  __INITIAL_TEST_ROLE__?: string;
  __INITIAL_TEST_SACCO__?: string;
}

test.describe('Navigation & Shell Route Audit', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      console.log(`[Browser Console ${msg.type()}]: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.error(`[Browser PageError]: ${err.message}\n${err.stack || ''}`);
    });
  });

  test('SACCO shell sidebar links resolve without 404s', async ({ page }) => {
    // 1. Initialize authenticated SACCO user session before navigation
    await page.addInitScript(() => {
      const w = window as unknown as TestWindow;
      w.__TEST_AUTH_OVERRIDE__ = true;
      w.__INITIAL_TEST_ROLE__ = 'sacco_manager';
      w.__INITIAL_TEST_SACCO__ = 'sacco_metrolink';
    });

    await page.goto('/sacco');
    await expect(page).toHaveURL(/\/sacco/);
    await expect(page.locator('text=404 - Page Not Found')).not.toBeVisible();

    const saccoLinks = [
      '/sacco',
      '/sacco/fleet',
      '/sacco/vehicles',
      '/sacco/drivers',
      '/sacco/live-trips',
      '/sacco/violations',
      '/sacco/black-spots',
      '/sacco/reports',
      '/sacco/analytics',
      '/sacco/notifications',
      '/sacco/users',
      '/sacco/settings',
    ];

    for (const link of saccoLinks) {
      await page.goto(link);
      await expect(page.locator('text=404 - Page Not Found')).not.toBeVisible();
      expect(page.url()).toContain(link);
    }
  });

  test('Authority shell sidebar links resolve without 404s', async ({ page }) => {
    // 1. Initialize authenticated Authority user session before navigation
    await page.addInitScript(() => {
      const w = window as unknown as TestWindow;
      w.__TEST_AUTH_OVERRIDE__ = true;
      w.__INITIAL_TEST_ROLE__ = 'authority';
    });

    await page.goto('/authority');
    await expect(page).toHaveURL(/\/authority/);
    await expect(page.locator('text=404 - Page Not Found')).not.toBeVisible();

    const authorityLinks = [
      '/authority',
      '/authority/compliance',
      '/authority/black-spots',
      '/authority/inspections',
      '/authority/emergency',
      '/authority/complaints',
      '/authority/reports',
      '/authority/settings',
    ];

    for (const link of authorityLinks) {
      await page.goto(link);
      await expect(page.locator('text=404 - Page Not Found')).not.toBeVisible();
      expect(page.url()).toContain(link);
    }
  });

  test('Admin shell sidebar links resolve without 404s', async ({ page }) => {
    // 1. Initialize authenticated Admin user session before navigation
    await page.addInitScript(() => {
      const w = window as unknown as TestWindow;
      w.__TEST_AUTH_OVERRIDE__ = true;
      w.__INITIAL_TEST_ROLE__ = 'admin';
    });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('text=404 - Page Not Found')).not.toBeVisible();

    const adminLinks = [
      '/admin',
      '/admin/users',
      '/admin/roles',
      '/admin/saccos',
      '/admin/authorities',
      '/admin/vehicles',
      '/admin/trips',
      '/admin/analytics',
      '/admin/reports',
      '/admin/moderation',
      '/admin/audit-logs',
      '/admin/monitoring',
      '/admin/integrations',
      '/admin/feature-flags',
      '/admin/system-health',
      '/admin/settings',
      '/admin/maintenance',
      '/admin/docs',
      '/admin/profile',
    ];

    for (const link of adminLinks) {
      await page.goto(link);
      await expect(page.locator('text=404 - Page Not Found')).not.toBeVisible();
      expect(page.url()).toContain(link);
    }
  });
});
