import { test, expect } from '@playwright/test';

test.describe('Mwendo Salama — Passenger Critical Journey', () => {
  test('Complete Passenger Journey: login -> start trip -> simulate GPS movement -> overspeed alert -> end trip -> summary -> logout', async ({
    page,
    context,
  }) => {
    // 1. Grant geolocation permissions and inject deterministic mock geolocation provider
    await context.grantPermissions(['geolocation']);

    await page.addInitScript(() => {
      try {
        localStorage.setItem('mwendosalama_kenya_dpa_2019_consent', 'granted');
        localStorage.setItem('mwendosalama_kenya_dpa_2019_consent_at', new Date().toISOString());
      } catch {
        // Ignored if storage is restricted
      }

      let watchCallbacks: Array<(pos: GeolocationPosition) => void> = [];
      let currentPos = {
        coords: {
          latitude: -1.286389,
          longitude: 36.817223,
          altitude: null,
          altitudeAccuracy: null,
          heading: 0,
          speed: 13.88, // 50 km/h
          accuracy: 5,
        },
        timestamp: Date.now(),
      };

      const fakeGeolocation = {
        getCurrentPosition: (success: (pos: GeolocationPosition) => void) => {
          success(currentPos as unknown as GeolocationPosition);
        },
        watchPosition: (success: (pos: GeolocationPosition) => void) => {
          watchCallbacks.push(success);
          success(currentPos as unknown as GeolocationPosition);
          return watchCallbacks.length;
        },
        clearWatch: (id: number) => {
          watchCallbacks = watchCallbacks.filter((_, index) => index + 1 !== id);
        },
      };

      (window as unknown as { __updateMockGps: (lat: number, lng: number, speedKmH: number) => void }).__updateMockGps = (
        lat: number,
        lng: number,
        speedKmH: number
      ) => {
        currentPos = {
          coords: {
            latitude: lat,
            longitude: lng,
            altitude: null,
            altitudeAccuracy: null,
            heading: 0,
            speed: speedKmH / 3.6,
            accuracy: 5,
          },
          timestamp: Date.now(),
        };
        for (const cb of watchCallbacks) {
          try {
            cb(currentPos as unknown as GeolocationPosition);
          } catch (e) {
            console.warn('Error in mock watch callback:', e);
          }
        }
      };

      Object.defineProperty(navigator, 'geolocation', {
        value: fakeGeolocation,
        writable: true,
      });
    });

    // 2. Login with demo credentials
    await page.goto('/auth/login');
    await page.waitForLoadState('domcontentloaded');

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });

    await emailInput.fill('passenger.demo@mwendo-salama.test');
    await passwordInput.fill('MwendoPassenger123!');
    await page.locator('button[type="submit"]').click();

    // Verify redirected to passenger dashboard
    await expect(page).toHaveURL(/\/passenger/, { timeout: 15000 });

    // 3. Start a trip
    const plateInput = page.locator('input[placeholder*="registration"], input#psv-plate-input').first();
    await expect(plateInput).toBeVisible({ timeout: 10000 });
    await plateInput.fill('KDB 892J');

    // Select SACCO if needed
    const saccoSelect = page.locator('#sacco-org-select');
    if (await saccoSelect.isVisible()) {
      await saccoSelect.selectOption({ index: 1 });
    }

    const startTripBtn = page.locator('button', { hasText: /Start Trip|Anza Safari/i }).first();
    await expect(startTripBtn).toBeEnabled({ timeout: 5000 });
    await startTripBtn.click();

    // Verify transition to Active Trip screen
    await expect(page).toHaveURL(/\/passenger\/start-trip/, { timeout: 10000 });
    await expect(page.locator('text=KM / H')).toBeVisible({ timeout: 10000 });

    // 4. Simulate GPS movement along route
    // First: Normal safe speed (55 km/h)
    await page.evaluate(() => {
      const update = (window as unknown as { __updateMockGps: (lat: number, lng: number, speedKmH: number) => void }).__updateMockGps;
      if (update) update(-1.286389, 36.817223, 55);
    });
    await page.waitForTimeout(400);

    // Second: Accelerate to overspeed (> 90 km/h) with multiple samples for EMA smoothing
    for (let i = 0; i < 6; i++) {
      await page.evaluate((iteration) => {
        const update = (window as unknown as { __updateMockGps: (lat: number, lng: number, speedKmH: number) => void }).__updateMockGps;
        if (update) {
          update(-1.275000 - iteration * 0.002, 36.825000 + iteration * 0.002, 98);
        }
      }, i);
      await page.waitForTimeout(200);
    }

    // Verify overspeed violation alert appears on the screen
    const overspeedAlert = page.locator('text=Overspeed Violation Detected!');
    await expect(overspeedAlert).toBeVisible({ timeout: 8000 });

    // 5. End trip
    const endTripBtn = page.locator('button', { hasText: /End Trip/i }).first();
    await expect(endTripBtn).toBeVisible();
    await endTripBtn.click();

    // Confirm end trip in modal
    const confirmEndBtn = page.locator('button', { hasText: /End Trip Now/i }).first();
    await expect(confirmEndBtn).toBeVisible({ timeout: 5000 });
    await confirmEndBtn.click();

    // 6. Verify summary appears
    const summaryTitle = page.locator('text=Trip Safety Summary');
    await expect(summaryTitle).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Total Duration')).toBeVisible();
    await expect(page.locator('text=Max Speed')).toBeVisible();
    await expect(page.locator('text=Overspeed Events')).toBeVisible();

    // Finish & return to dashboard
    const finishBtn = page.locator('button', { hasText: /Finish & Return to Dashboard/i });
    await expect(finishBtn).toBeVisible();
    await finishBtn.click({ force: true });
    await expect(page).toHaveURL(/\/passenger/, { timeout: 10000 });

    // 7. Logout
    const profileNavLink = page.locator('a[href="/passenger/profile"]').first();
    await profileNavLink.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    if (await profileNavLink.isVisible()) {
      await profileNavLink.click();
    } else {
      await page.goto('/passenger/profile');
    }
    await expect(page).toHaveURL(/\/passenger\/profile/, { timeout: 10000 });
    await expect(page.locator('text=Safety Rewards')).toBeVisible({ timeout: 10000 });

    const signOutBtn = page.locator('button', { hasText: /Sign Out|Toka/i });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // Verify redirected to login/welcome
    await expect(page).toHaveURL(/\/auth\/(login|welcome)/, { timeout: 10000 });
  });

  test('Public shared trip link is viewable without authentication', async ({ page }) => {
    await page.goto('/track/test_demo_trip_123');
    await page.waitForLoadState('domcontentloaded');

    // Should not redirect to /auth/login
    await expect(page).not.toHaveURL(/\/auth\/login/);

    // Should display Mwendo Salama Shared Live Trip header
    const title = page.locator('h1, h2, div', { hasText: /Mwendo Salama|Live Trip Safety Status/i }).first();
    await expect(title).toBeVisible();
  });
});
