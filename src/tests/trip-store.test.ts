// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../store/useTripStore';
import { useAuthStore } from '../store/useAuthStore';

describe('Trip Store: ownership, lifecycle & duplicate-trip boundaries', () => {
  beforeEach(() => {
    useTripStore.getState().resetTrip();
    useAuthStore.setState({
      user: {
        id: 'user_passenger_1',
        uid: 'user_passenger_1',
        email: 'passenger@mwendo.co.ke',
        displayName: 'Jane Passenger',
        role: 'passenger',
        claimedActiveRole: 'passenger',
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('preserves the resolved SACCO ownership when starting a trip', () => {
    useTripStore.getState().startTrip({
      plateNumber: 'KDA 123A',
      saccoId: 'sacco_x',
      saccoName: 'SACCO X Express',
      routeName: 'Thika Road Corridor',
    });

    const activeTrip = useTripStore.getState().activeTrip;
    expect(activeTrip).not.toBeNull();
    expect(activeTrip?.saccoId).toBe('sacco_x');
    expect(activeTrip?.saccoName).toBe('SACCO X Express');
    expect(activeTrip?.plateNumber).toBe('KDA 123A');
    expect(activeTrip?.vehicleRegNumber).toBe('KDA 123A');
    expect(activeTrip?.status).toBe('active');
  });

  it('rejects a trip without a verified SACCO rather than creating an unassigned trip', () => {
    expect(() =>
      useTripStore.getState().startTrip({
        plateNumber: 'KBZ 999Z',
        routeName: 'Waiyaki Way',
      }),
    ).toThrow('TRIP002: A verified SACCO is required to start a trip.');

    expect(useTripStore.getState().activeTrip).toBeNull();
    expect(useTripStore.getState().isTracking).toBe(false);
  });

  it('rejects a second active trip until the first trip is completed', () => {
    useTripStore.getState().startTrip({
      vehicleId: 'vehicle_1',
      plateNumber: 'KDA 123A',
      saccoId: 'sacco_x',
    });

    const firstTripId = useTripStore.getState().activeTrip?.id;

    expect(() =>
      useTripStore.getState().startTrip({
        vehicleId: 'vehicle_2',
        plateNumber: 'KDB 456B',
        saccoId: 'sacco_x',
      }),
    ).toThrow('TRIP001: An active trip is already in progress.');

    expect(useTripStore.getState().activeTrip?.id).toBe(firstTripId);
    expect(useTripStore.getState().activeTrip?.plateNumber).toBe('KDA 123A');
  });

  it('completes the active trip and permits a new trip afterwards', () => {
    useTripStore.getState().startTrip({
      vehicleId: 'vehicle_1',
      plateNumber: 'KDA 123A',
      saccoId: 'sacco_x',
    });

    useTripStore.getState().updateTelemetry(42, {
      latitude: -1.2801,
      longitude: 36.8219,
      speedKmH: 42,
      accuracy: 8,
      timestamp: '2026-08-30T10:00:00.000Z',
    });

    const completed = useTripStore.getState().endTrip();
    expect(completed?.status).toBe('completed');
    expect(completed?.vehicleId).toBe('vehicle_1');
    expect(completed?.saccoId).toBe('sacco_x');
    expect(useTripStore.getState().activeTrip).toBeNull();
    expect(useTripStore.getState().isTracking).toBe(false);

    expect(() =>
      useTripStore.getState().startTrip({
        vehicleId: 'vehicle_2',
        plateNumber: 'KDB 456B',
        saccoId: 'sacco_x',
      }),
    ).not.toThrow();
    expect(useTripStore.getState().activeTrip?.plateNumber).toBe('KDB 456B');
  });
});
