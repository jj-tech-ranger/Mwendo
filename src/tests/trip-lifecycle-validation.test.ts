import { describe, expect, it, beforeEach } from 'vitest';
import { useTripStore } from '../store/useTripStore';

describe('Trip lifecycle validation', () => {
  beforeEach(() => {
    useTripStore.getState().resetTrip();
  });

  const gps = (timestamp: string, overrides: Partial<{ latitude:number; longitude:number; speedKmH:number; accuracy:number }> = {}) => ({
    latitude: 1.29, longitude: 36.82, speedKmH: 40, accuracy: 10, timestamp, ...overrides,
  });

  it('requires a real SACCO instead of silently creating an unassigned trip', () => {
    expect(() => useTripStore.getState().startTrip({ plateNumber: 'KDA 123A' })).toThrow('TRIP002');
    expect(() => useTripStore.getState().startTrip({ plateNumber: 'KDA 123A', saccoId: 'unassigned' })).toThrow('TRIP002');
  });

  it('prevents a second active trip in the same persisted client state', () => {
    useTripStore.getState().startTrip({ vehicleId: 'vehicle-1', plateNumber: 'KDA 123A', saccoId: 'sacco-1' });
    expect(() => useTripStore.getState().startTrip({ vehicleId: 'vehicle-2', plateNumber: 'KDB 456B', saccoId: 'sacco-1' })).toThrow('TRIP001');
  });

  it('accepts valid GPS and rejects coordinates outside Kenya', () => {
    useTripStore.getState().startTrip({ vehicleId: 'vehicle-1', plateNumber: 'KDA 123A', saccoId: 'sacco-1' });
    useTripStore.getState().updateTelemetry(40, gps('2026-08-30T10:00:00.000Z'));
    expect(useTripStore.getState().routeCoordinates).toHaveLength(1);
    useTripStore.getState().updateTelemetry(40, gps('2026-08-30T10:00:05.000Z', { latitude: 50 }));
    expect(useTripStore.getState().routeCoordinates).toHaveLength(1);
  });

  it('rejects stale or duplicate GPS timestamps', () => {
    useTripStore.getState().startTrip({ vehicleId: 'vehicle-1', plateNumber: 'KDA 123A', saccoId: 'sacco-1' });
    useTripStore.getState().updateTelemetry(40, gps('2026-08-30T10:00:05.000Z'));
    useTripStore.getState().updateTelemetry(60, gps('2026-08-30T10:00:04.000Z'));
    useTripStore.getState().updateTelemetry(60, gps('2026-08-30T10:00:05.000Z'));
    expect(useTripStore.getState().routeCoordinates).toHaveLength(1);
    expect(useTripStore.getState().currentSpeed).toBe(40);
  });

  it('rejects invalid accuracy and implausible speed', () => {
    useTripStore.getState().startTrip({ vehicleId: 'vehicle-1', plateNumber: 'KDA 123A', saccoId: 'sacco-1' });
    useTripStore.getState().updateTelemetry(40, gps('2026-08-30T10:00:00.000Z', { accuracy: 0 }));
    useTripStore.getState().updateTelemetry(200, gps('2026-08-30T10:00:05.000Z', { speedKmH: 200 }));
    expect(useTripStore.getState().routeCoordinates).toHaveLength(0);
  });
});
