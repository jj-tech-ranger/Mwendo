import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyticsService } from '../services/analyticsService';
import { useAuthStore } from '../store/useAuthStore';

// Mock localStorage
const mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = val;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k];
  },
});

describe('SEC-006 & SEC-007: Kenya DPA 2019 Analytics Consent', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().setUser(null, null);
  });

  it('reports hasConsentChoice() as false when neither localStorage nor profile has decision', () => {
    expect(analyticsService.hasConsentChoice()).toBe(false);
    expect(analyticsService.hasDpaConsent()).toBe(false);
    expect(analyticsService.getDpaConsent()).toBeNull();
  });

  it('records explicit consent in localStorage and state when set to true', async () => {
    await analyticsService.setDpaConsent(true);
    expect(analyticsService.hasConsentChoice()).toBe(true);
    expect(analyticsService.hasDpaConsent()).toBe(true);
    expect(analyticsService.getDpaConsent()).toBe(true);
    expect(localStorage.getItem('mwendosalama_kenya_dpa_2019_consent')).toBe('granted');
  });

  it('records explicit refusal in localStorage and state when set to false', async () => {
    await analyticsService.setDpaConsent(false);
    expect(analyticsService.hasConsentChoice()).toBe(true);
    expect(analyticsService.hasDpaConsent()).toBe(false);
    expect(analyticsService.getDpaConsent()).toBe(false);
    expect(localStorage.getItem('mwendosalama_kenya_dpa_2019_consent')).toBe('denied');
  });

  it('synchronizes consent from loaded user profile', () => {
    analyticsService.syncConsentFromProfile({
      analyticsConsent: true,
      analyticsConsentAt: '2026-08-17T10:00:00.000Z',
    });

    expect(analyticsService.hasConsentChoice()).toBe(true);
    expect(analyticsService.hasDpaConsent()).toBe(true);
    expect(localStorage.getItem('mwendosalama_kenya_dpa_2019_consent')).toBe('granted');
    expect(localStorage.getItem('mwendosalama_kenya_dpa_2019_consent_at')).toBe('2026-08-17T10:00:00.000Z');
  });
});
