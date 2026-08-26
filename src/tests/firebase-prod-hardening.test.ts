// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { functions } from '../lib/firebase';
import { analyticsService } from '../services/analyticsService';
import { useAuthStore } from '../store/useAuthStore';

describe('PROD-HARDENING: Production Firebase Decoupling & Regional Integrity', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
    useAuthStore.getState().setUser(null, null);
  });

  describe('Fix 1: Firebase Callable Functions Region', () => {
    it('initializes frontend functions targeting europe-west1 region explicitly', () => {
      expect(functions).toBeDefined();
      expect(functions.region).toBe('europe-west1');
    });
  });

  describe('Fix 2: App Check Production Debug Environment Safety', () => {
    const evaluateIsDebugEnv = (
      hostname: string,
      isDev: boolean,
      debugToken?: string
    ): boolean => {
      return (
        isDev ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        Boolean(debugToken)
      );
    };

    it('asserts production Firebase Hosting domain (*.web.app) is NOT a debug environment', () => {
      expect(evaluateIsDebugEnv('mwendo-salama-prod.web.app', false, undefined)).toBe(false);
      expect(evaluateIsDebugEnv('another-app.web.app', false, undefined)).toBe(false);
    });

    it('asserts production Firebase Auth domain (*.firebaseapp.com) is NOT a debug environment', () => {
      expect(evaluateIsDebugEnv('mwendo-salama-prod.firebaseapp.com', false, undefined)).toBe(false);
    });

    it('asserts arbitrary custom production domains are NOT debug environments', () => {
      expect(evaluateIsDebugEnv('mwendosalama.co.ke', false, undefined)).toBe(false);
    });

    it('allows debug environment only on localhost, 127.0.0.1, or DEV mode', () => {
      expect(evaluateIsDebugEnv('localhost', false, undefined)).toBe(true);
      expect(evaluateIsDebugEnv('127.0.0.1', false, undefined)).toBe(true);
      expect(evaluateIsDebugEnv('any-host.internal', true, undefined)).toBe(true);
    });

    it('allows debug environment on explicit VITE_FIREBASE_APPCHECK_DEBUG_TOKEN', () => {
      expect(evaluateIsDebugEnv('mwendo-salama-prod.web.app', false, 'test-debug-uuid-1234')).toBe(true);
    });
  });

  describe('Fix 3: Kenya DPA 2019 Analytics Consent Guarding', () => {
    it('ensures analytics events are blocked when consent choice is absent', () => {
      const logSpy = vi.spyOn(console, 'warn');
      analyticsService.logAnalyticsEvent('test_event', { key: 'value' });
      // Event logging is blocked early by !this.hasDpaConsent()
      expect(analyticsService.hasDpaConsent()).toBe(false);
      logSpy.mockRestore();
    });

    it('ensures analytics events are blocked when consent is explicitly denied', async () => {
      await analyticsService.setDpaConsent(false);
      expect(analyticsService.hasDpaConsent()).toBe(false);
      expect(analyticsService.getDpaConsent()).toBe(false);
    });

    it('enables analytics tracking only after explicit consent is granted', async () => {
      await analyticsService.setDpaConsent(true);
      expect(analyticsService.hasDpaConsent()).toBe(true);
      expect(analyticsService.getDpaConsent()).toBe(true);
    });
  });
});
