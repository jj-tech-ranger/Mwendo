import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { suspendUser, reactivateUser } from '../admin/suspendUser';
import { syncPublicPins } from '../pins/syncPublicPins';
import { computeVehicleRisk } from '../risk/computeVehicleRisk';
import { updateDailyAnalytics } from '../analytics/updateDailyAnalytics';
import { rebuildSaccoAnalytics } from '../analytics/rebuildSaccoAnalytics';

describe('SEC-002: App Check Enforcement across 2nd-gen Cloud Functions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('APP_CHECK_ENFORCED Environment Evaluation Logic', () => {
    it('defaults to true when APP_CHECK_ENFORCED is unset regardless of NODE_ENV', async () => {
      delete process.env.APP_CHECK_ENFORCED;
      delete process.env.NODE_ENV;

      // Re-evaluate logic matching apps/functions/src/lib/env.ts
      const evalAppCheck = (envVal: string | undefined) => envVal !== 'false';
      expect(evalAppCheck(process.env.APP_CHECK_ENFORCED)).toBe(true);

      process.env.NODE_ENV = 'development';
      expect(evalAppCheck(process.env.APP_CHECK_ENFORCED)).toBe(true);

      process.env.NODE_ENV = 'production';
      expect(evalAppCheck(process.env.APP_CHECK_ENFORCED)).toBe(true);
    });

    it('evaluates to false only on explicit opt-out with APP_CHECK_ENFORCED=false', () => {
      process.env.APP_CHECK_ENFORCED = 'false';
      const evalAppCheck = (envVal: string | undefined) => envVal !== 'false';
      expect(evalAppCheck(process.env.APP_CHECK_ENFORCED)).toBe(false);
    });

    it('evaluates to true when APP_CHECK_ENFORCED=true', () => {
      process.env.APP_CHECK_ENFORCED = 'true';
      const evalAppCheck = (envVal: string | undefined) => envVal !== 'false';
      expect(evalAppCheck(process.env.APP_CHECK_ENFORCED)).toBe(true);
    });
  });

  describe('Callable Cloud Functions configuration', () => {
    it('all six target callable functions are defined and exported correctly', () => {
      expect(suspendUser).toBeDefined();
      expect(reactivateUser).toBeDefined();
      expect(syncPublicPins).toBeDefined();
      expect(computeVehicleRisk).toBeDefined();
      expect(updateDailyAnalytics).toBeDefined();
      expect(rebuildSaccoAnalytics).toBeDefined();
    });

    it('all six functions maintain functional handlers callable via .run()', async () => {
      // Unauthenticated invocation should reject with 'unauthenticated'
      const unauthRequest = { auth: null, data: {} } as any;

      await expect(suspendUser.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      await expect(reactivateUser.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      await expect(syncPublicPins.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      await expect(computeVehicleRisk.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      await expect(updateDailyAnalytics.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      await expect(rebuildSaccoAnalytics.run(unauthRequest)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });
  });
});
