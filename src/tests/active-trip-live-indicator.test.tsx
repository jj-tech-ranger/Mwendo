// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActiveTripScreen } from '../features/passenger/ActiveTripScreen';
import { useTripStore } from '../store/useTripStore';
import { useAuthStore } from '../store/useAuthStore';

vi.mock('../services/telemetryPersistenceService', () => ({
  telemetryPersistenceService: {
    getSamples: vi.fn().mockResolvedValue([]),
    appendSample: vi.fn().mockResolvedValue(undefined),
    clearSamples: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/functionsService', () => ({
  functionsService: {
    generateTripSummary: vi.fn().mockResolvedValue({
      success: true,
      summary: 'Trip completed safely.',
      riskTier: 'low',
      overspeedEventsCount: 0,
      generatedBy: 'rule_engine',
    }),
  },
}));

describe('ActiveTripScreen: Live GPS & Connectivity Status Indicator (Prompt 11)', () => {
  let watchPositionSuccess: ((pos: GeolocationPosition) => void) | null = null;
  let watchPositionError: ((err: GeolocationPositionError) => void) | null = null;
  const originalGeolocation = navigator.geolocation;
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
    useTripStore.getState().resetTrip();

    useAuthStore.setState({
      user: {
        uid: 'user_123',
        id: 'user_123',
        displayName: 'Test Passenger',
        email: 'passenger@example.com',
        role: 'passenger',
        activeRole: 'passenger',
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: {
        watchPosition: vi.fn().mockImplementation((success, error) => {
          watchPositionSuccess = success;
          watchPositionError = error;
          return 101;
        }),
        clearWatch: vi.fn(),
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
    useTripStore.getState().resetTrip();
  });

  it('renders live GPS accuracy and updates indicator when accuracy degrades (>30m threshold)', async () => {
    useTripStore.getState().startTrip({
      plateNumber: 'KDA 123A',
      saccoId: 'sacco_1',
      saccoName: 'Super Metro SACCO',
      routeName: 'Thika Road Corridor',
    });

    render(
      <MemoryRouter>
        <ActiveTripScreen />
      </MemoryRouter>
    );

    // Initial state before receiving GPS sample
    const gpsBadge = screen.getByTestId('gps-status-badge');
    expect(gpsBadge.textContent).toContain('Acquiring GPS');

    // Simulate high quality GPS sample (accuracy = 8m <= 15m)
    await act(async () => {
      if (watchPositionSuccess) {
        watchPositionSuccess({
          coords: {
            latitude: -1.286389,
            longitude: 36.817223,
            accuracy: 8,
            speed: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }
    });

    expect(gpsBadge.textContent).toContain('GPS Good (±8m)');
    expect(gpsBadge.getAttribute('data-status')).toBe('good');

    // Simulate degraded GPS sample exceeding the 30m engine threshold (e.g. 45m)
    await act(async () => {
      if (watchPositionSuccess) {
        watchPositionSuccess({
          coords: {
            latitude: -1.286400,
            longitude: 36.817300,
            accuracy: 45,
            speed: 15,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition);
      }
    });

    expect(gpsBadge.textContent).toContain('GPS Degraded (±45m)');
    expect(gpsBadge.getAttribute('data-status')).toBe('degraded');
  });

  it('renders live online status and updates immediately when offline and online window events fire', async () => {
    useTripStore.getState().startTrip({
      plateNumber: 'KDA 123A',
      saccoId: 'sacco_1',
      saccoName: 'Super Metro SACCO',
      routeName: 'Thika Road Corridor',
    });

    render(
      <MemoryRouter>
        <ActiveTripScreen />
      </MemoryRouter>
    );

    const connectivityBadge = screen.getByTestId('connectivity-status-badge');
    expect(connectivityBadge.textContent).toContain('Online');
    expect(connectivityBadge.getAttribute('data-online')).toBe('true');

    // Simulate going offline
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(connectivityBadge.textContent).toContain('Offline (Local Log)');
    expect(connectivityBadge.getAttribute('data-online')).toBe('false');

    // Simulate reconnecting
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(connectivityBadge.textContent).toContain('Online');
    expect(connectivityBadge.getAttribute('data-online')).toBe('true');
  });

  it('updates GPS status badge to GPS Lost when geolocation returns an error', async () => {
    useTripStore.getState().startTrip({
      plateNumber: 'KDA 123A',
      saccoId: 'sacco_1',
      saccoName: 'Super Metro SACCO',
      routeName: 'Thika Road Corridor',
    });

    render(
      <MemoryRouter>
        <ActiveTripScreen />
      </MemoryRouter>
    );

    const gpsBadge = screen.getByTestId('gps-status-badge');

    // Trigger position error
    await act(async () => {
      if (watchPositionError) {
        watchPositionError({
          code: 1,
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      }
    });

    expect(gpsBadge.textContent).toContain('GPS Lost');
    expect(gpsBadge.getAttribute('data-status')).toBe('lost');
  });
});
