// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VehicleLookupScreen } from '../features/passenger/VehicleLookupScreen';
import { vehiclePublicSummaryRepository, saccoRepository } from '../repositories';
import { useTripStore } from '../store/useTripStore';

describe('FEAT: Passenger Vehicle Lookup Screen ("Check Before You Board")', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useTripStore.getState().resetTrip();
  });

  it('renders lookup header, input field, and educational guidance', () => {
    render(
      <MemoryRouter initialEntries={['/passenger/lookup']}>
        <Routes>
          <Route path="/passenger/lookup" element={<VehicleLookupScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Check Before You Board/i)).toBeTruthy();
    expect(screen.getByLabelText(/Vehicle plate number search/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Check/i })).toBeTruthy();
    expect(screen.getByText(/Why check before boarding\?/i)).toBeTruthy();
  });

  it('searches registered vehicle and displays safety standing, risk tier, and SACCO affiliation without leaking internal fields', async () => {
    vi.spyOn(vehiclePublicSummaryRepository, 'findByNormalizedPlate').mockResolvedValueOnce({
      id: 'KDA123A',
      vehicleId: 'KDA123A',
      regNumber: 'KDA 123A',
      saccoId: 'sacco_metro',
      saccoName: 'Super Metro SACCO',
      riskTier: 'low',
      riskScore: 25,
      isProvisional: false,
      status: 'active',
    });

    vi.spyOn(saccoRepository, 'getById').mockResolvedValueOnce({
      id: 'sacco_metro',
      name: 'Super Metro SACCO',
      registrationCode: 'SACCO-001',
      fleetCount: 150,
      safetyScore: 92,
      contactPhone: '+254700000000',
      contactEmail: 'safety@supermetro.co.ke',
      status: 'active',
    });

    render(
      <MemoryRouter initialEntries={['/passenger/lookup']}>
        <Routes>
          <Route path="/passenger/lookup" element={<VehicleLookupScreen />} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/Vehicle plate number search/i);
    fireEvent.change(input, { target: { value: 'kda 123a' } });

    const checkBtn = screen.getByRole('button', { name: /Check/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText('KDA 123A')).toBeTruthy();
    });

    expect(screen.getByText('Low Risk')).toBeTruthy();
    expect(screen.getByText('Super Metro SACCO')).toBeTruthy();
    expect(screen.getByText('Accredited SACCO Fleet')).toBeTruthy();
    expect(screen.getByText(/92\/100/i)).toBeTruthy();
    expect(screen.getByText(/Board with confidence/i)).toBeTruthy();

    // Security check: Must NEVER expose internal operational fields
    expect(screen.queryByText(/insuranceExpiry/i)).toBeNull();
    expect(screen.queryByText(/inspectionExpiry/i)).toBeNull();
  });

  it('displays provisional status and supportive guidance for unregistered vehicles', async () => {
    vi.spyOn(vehiclePublicSummaryRepository, 'findByNormalizedPlate').mockResolvedValueOnce(null);

    render(
      <MemoryRouter initialEntries={['/passenger/lookup']}>
        <Routes>
          <Route path="/passenger/lookup" element={<VehicleLookupScreen />} />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/Vehicle plate number search/i);
    fireEvent.change(input, { target: { value: 'KZZ 999X' } });

    const checkBtn = screen.getByRole('button', { name: /Check/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText('KZZ999X')).toBeTruthy();
    });

    expect(screen.getByText(/Provisional \/ Unregistered/i)).toBeTruthy();
    expect(screen.getByText(/Independent \/ Unregistered PSV/i)).toBeTruthy();
    expect(screen.getByText(/No historical risk data on record/i)).toBeTruthy();
  });

  it('initiates trip tracking when clicking "Board This Vehicle & Track Trip"', async () => {
    vi.spyOn(vehiclePublicSummaryRepository, 'findByNormalizedPlate').mockResolvedValueOnce({
      id: 'KDA123A',
      vehicleId: 'KDA123A',
      regNumber: 'KDA 123A',
      saccoId: 'sacco_metro',
      saccoName: 'Super Metro SACCO',
      riskTier: 'low',
      riskScore: 25,
      isProvisional: false,
    });

    render(
      <MemoryRouter initialEntries={['/passenger/lookup?plate=KDA123A']}>
        <Routes>
          <Route path="/passenger/lookup" element={<VehicleLookupScreen />} />
          <Route path="/passenger/start-trip" element={<div data-testid="start-trip-target">Start Trip Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('KDA 123A')).toBeTruthy();
    });

    const boardBtn = screen.getByRole('button', { name: /Board This Vehicle & Track Trip/i });
    fireEvent.click(boardBtn);

    const activeTrip = useTripStore.getState().activeTrip;
    expect(activeTrip).not.toBeNull();
    expect(activeTrip?.plateNumber).toBe('KDA 123A');
    expect(activeTrip?.vehicleId).toBe('KDA123A');
    expect(activeTrip?.saccoId).toBe('sacco_metro');
    expect(activeTrip?.isProvisional).toBe(false);

    expect(screen.getByTestId('start-trip-target')).toBeTruthy();
  });

  it('stores and renders recent plate checks in local storage', async () => {
    localStorage.setItem(
      'mwendo_recent_vehicle_lookups',
      JSON.stringify(['KBB111B', 'KCC222C'])
    );

    render(
      <MemoryRouter initialEntries={['/passenger/lookup']}>
        <Routes>
          <Route path="/passenger/lookup" element={<VehicleLookupScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('KBB111B')).toBeTruthy();
    expect(screen.getByText('KCC222C')).toBeTruthy();
  });
});
