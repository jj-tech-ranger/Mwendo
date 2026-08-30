// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useTripStore } from '../store/useTripStore';
import { useAuthStore } from '../store/useAuthStore';

describe('MED-01: Trip Store Dynamic saccoId & Zero Hardcoded SACCO Literals', () => {
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

  it('MED-01: startTrip called with an explicit saccoId preserves the resolved SACCO ownership', () => {
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
  });

  it('MED-01: startTrip without a verified SACCO is rejected rather than creating an unassigned trip', () => {
    expect(() =>
      useTripStore.getState().startTrip({
        plateNumber: 'KBZ 999Z',
        routeName: 'Waiyaki Way',
      }),
    ).toThrow('TRIP002: A verified SACCO is required to start a trip.');

    expect(useTripStore.getState().activeTrip).toBeNull();
    expect(useTripStore.getState().isTracking).toBe(false);
  });
});
