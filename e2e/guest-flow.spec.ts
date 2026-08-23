import { test, expect } from '@playwright/test';

test.describe('Guest Commuter Flow', () => {
  test('landing page primary CTA leads to permissions and reaches passenger screen', async ({ page }) => {
    // 1. Visit landing page with fresh context
    await page.goto('/');

    // 2. Locate and click primary CTA ("Start a Safe Trip" / "Get Started")
    const primaryCta = page.getByRole('button', { name: /Start a Safe Trip|Get Started/i }).first();
    await expect(primaryCta).toBeVisible({ timeout: 15000 });
    await primaryCta.click();

    // 3. Should land on location-permission wizard / prompt
    await expect(page).toHaveURL(/\/location-permission/, { timeout: 10000 });

    // 4. Click Skip All to complete wizard and proceed to passenger mode
    const skipAllBtn = page.getByRole('button', { name: 'Skip All' });
    await expect(skipAllBtn).toBeVisible({ timeout: 10000 });
    await skipAllBtn.click();

    // 5. Assert final destination is /passenger and NOT redirected to /auth/login
    await page.waitForURL('**/passenger', { timeout: 15000 });
    expect(page.url()).toContain('/passenger');
    expect(page.url()).not.toContain('/auth/login');
  });
});
