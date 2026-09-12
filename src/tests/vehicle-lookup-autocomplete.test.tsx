import { describe, expect, it, beforeEach, vi } from 'vitest';
import { normalizePlate, isValidPlateFormat } from '../lib/plate';
import { useTripStore } from '../store/useTripStore';
import { vehicleRepository } from '../repositories';

describe('BUG-001: Vehicle Lookup, Autocomplete & Plate Normalization', () => {
  beforeEach(() => {
    useTripStore.getState().resetTrip();
    vi.clearAllMocks();
  });

  describe('normalizePlate utility', () => {
    it('strips all internal, leading, and trailing whitespace and converts to uppercase', () => {
      expect(normalizePlate('KAA 123B')).toBe('KAA123B');
      expect(normalizePlate('  kaa 123b  ')).toBe('KAA123B');
      expect(normalizePlate('K B Z   9 9 9 Z')).toBe('KBZ999Z');
      expect(normalizePlate('kda001a')).toBe('KDA001A');
      expect(normalizePlate('KDA 001 A')).toBe('KDA001A');
    });

    it('handles empty or undefined inputs safely', () => {
      expect(normalizePlate('')).toBe('');
      expect(normalizePlate(undefined as unknown as string)).toBe('');
      expect(normalizePlate(null as unknown as string)).toBe('');
    });

    it('validates plate format with or without internal whitespace', () => {
      expect(isValidPlateFormat('KAA 123B')).toBe(true);
      expect(isValidPlateFormat('KAA123B')).toBe(true);
      expect(isValidPlateFormat('KDA 001A')).toBe(true);
      expect(isValidPlateFormat('KBZ999Z')).toBe(true);
      expect(isValidPlateFormat('123 KAA')).toBe(false);
      expect(isValidPlateFormat('TOOLONG12345')).toBe(false);
    });
  });

  describe('Trip store integration with registered vs. provisional vehicles', () => {
    it('attaches verified vehicleId and marks isProvisional: false when matching vehicle is provided', () => {
      useTripStore.getState().startTrip({
        vehicleId: 'v_metro_01',
        plateNumber: 'KDA 123A',
        saccoId: 'sacco_metro',
        saccoName: 'Super Metro SACCO',
        routeName: 'Thika Road Corridor',
        isProvisional: false,
      });

      const trip = useTripStore.getState().activeTrip;
      expect(trip).not.toBeNull();
      expect(trip?.vehicleId).toBe('v_metro_01');
      expect(trip?.isProvisional).toBe(false);
      expect(trip?.saccoId).toBe('sacco_metro');
      expect(trip?.saccoName).toBe('Super Metro SACCO');
      expect(trip?.status).toBe('active');
    });

    it('flags trip as isProvisional: true and DOES NOT attach a vehicleId when vehicle is unregistered', () => {
      useTripStore.getState().startTrip({
        plateNumber: 'KAA 999Z',
        saccoId: 'sacco_metro',
        saccoName: 'Super Metro SACCO',
        routeName: 'Waiyaki Way',
        isProvisional: true,
      });

      const trip = useTripStore.getState().activeTrip;
      expect(trip).not.toBeNull();
      expect(trip?.vehicleId).toBeUndefined();
      expect(trip?.isProvisional).toBe(true);
      expect(trip?.plateNumber).toBe('KAA 999Z');
    });

    it('defaults to isProvisional: true if vehicleId is absent', () => {
      useTripStore.getState().startTrip({
        plateNumber: 'KBB 111A',
        saccoId: 'sacco_metro',
        saccoName: 'Super Metro SACCO',
      });

      const trip = useTripStore.getState().activeTrip;
      expect(trip?.isProvisional).toBe(true);
      expect(trip?.vehicleId).toBeUndefined();
    });
  });

  describe('VehicleRepository lookup and autocomplete helpers', () => {
    it('normalizes plate before looking up by document ID or query', async () => {
      const getByIdSpy = vi.spyOn(vehicleRepository, 'getById').mockResolvedValueOnce({
        id: 'KAA123B',
        regNumber: 'KAA123B',
        saccoId: 'sacco_metro',
        saccoName: 'Super Metro SACCO',
        capacity: 33,
        status: 'active',
        insuranceExpiry: '2027-12-31',
        inspectionExpiry: '2027-12-31',
      });

      const vehicle = await vehicleRepository.findByNormalizedPlate('kAa   123b');
      expect(getByIdSpy).toHaveBeenCalledWith('KAA123B');
      expect(vehicle).not.toBeNull();
      expect(vehicle?.id).toBe('KAA123B');
      expect(vehicle?.saccoId).toBe('sacco_metro');
    });

    it('returns empty array when prefix query has fewer than 2 characters', async () => {
      const results = await vehicleRepository.searchVehicles('K');
      expect(results).toEqual([]);
    });
  });
});
