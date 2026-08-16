// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SaccoDashboard } from '../features/sacco/SaccoDashboard';
import { useAuthStore } from '../store/useAuthStore';
import {
  tripRepository,
  vehicleRepository,
  violationRepository,
  complaintRepository,
  analyticsRepository,
} from '../repositories';
import { calculateSaccoSafetyScore } from '../lib/engine';
import '../services/i18n';

describe('AN-002: SaccoDashboard Canonical Safety Score Computation', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    testQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    useAuthStore.setState({
      user: {
        id: 'manager_1',
        uid: 'manager_1',
        email: 'manager@metrolink.co.ke',
        displayName: 'MetroLink Manager',
        role: 'sacco_manager',
        saccoId: 'sacco_metrolink',
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders SACCO safety score computed canonically via calculateSaccoSafetyScore from real vehicle scores and unresolved complaints', async () => {
    const mockVehicles = [
      { id: 'v1', saccoId: 'sacco_metrolink', riskScore: 92, status: 'active' },
      { id: 'v2', saccoId: 'sacco_metrolink', riskScore: 84, status: 'active' },
      { id: 'v3', saccoId: 'sacco_metrolink', riskScore: 70, status: 'suspended' },
    ];

    const mockComplaints = [
      { id: 'c1', saccoId: 'sacco_metrolink', status: 'open' },
      { id: 'c2', saccoId: 'sacco_metrolink', status: 'investigating' },
      { id: 'c3', saccoId: 'sacco_metrolink', status: 'resolved' }, // should not count
    ];

    const mockTrips = [
      { id: 't1', saccoId: 'sacco_metrolink' },
      { id: 't2', saccoId: 'sacco_metrolink' },
    ];

    const mockViolations = [
      { id: 'vio1', saccoId: 'sacco_metrolink' },
      { id: 'vio2', saccoId: 'sacco_metrolink' },
      { id: 'vio3', saccoId: 'sacco_metrolink' },
      { id: 'vio4', saccoId: 'sacco_metrolink' },
    ];

    vi.spyOn(tripRepository, 'getAll').mockResolvedValue(mockTrips as any);
    vi.spyOn(vehicleRepository, 'getAll').mockResolvedValue(mockVehicles as any);
    vi.spyOn(violationRepository, 'getAll').mockResolvedValue(mockViolations as any);
    vi.spyOn(complaintRepository, 'getAll').mockResolvedValue(mockComplaints as any);
    vi.spyOn(analyticsRepository, 'getById').mockResolvedValue(null as any);

    // Compute expected canonical score
    const vehicleScores = mockVehicles.map((v) => v.riskScore);
    const unresolvedComplaintsCount = 2; // open + investigating
    const expectedCanonicalScore = calculateSaccoSafetyScore(vehicleScores, unresolvedComplaintsCount);

    // [92, 84, 70] avg = 82; 2 complaints deduction = 4; score = 78
    expect(expectedCanonicalScore).toBe(78);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter>
          <SaccoDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for the dashboard to finish loading and display the safety score
    await waitFor(() => {
      expect(screen.queryByText(/Account Not Fully Provisioned/i)).toBeNull();
      const scoreElement = screen.getByText(String(expectedCanonicalScore));
      expect(scoreElement).toBeTruthy();
    });

    // Verify Grade B is displayed for score 78
    expect(screen.getByText(/Grade B - Standard SACCO/i)).toBeTruthy();
  });

  it('renders perfect 100 Grade A score when fleet vehicles have 100 risk score and 0 complaints', async () => {
    const mockVehicles = [
      { id: 'v1', saccoId: 'sacco_metrolink', riskScore: 100, status: 'active' },
      { id: 'v2', saccoId: 'sacco_metrolink', riskScore: 100, status: 'active' },
    ];

    const mockComplaints = [
      { id: 'c1', saccoId: 'sacco_metrolink', status: 'resolved' },
    ];

    vi.spyOn(tripRepository, 'getAll').mockResolvedValue([] as any);
    vi.spyOn(vehicleRepository, 'getAll').mockResolvedValue(mockVehicles as any);
    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([] as any);
    vi.spyOn(complaintRepository, 'getAll').mockResolvedValue(mockComplaints as any);
    vi.spyOn(analyticsRepository, 'getById').mockResolvedValue(null as any);

    const expectedScore = calculateSaccoSafetyScore([100, 100], 0);
    expect(expectedScore).toBe(100);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter>
          <SaccoDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const scoreElement = screen.getByText('100');
      expect(scoreElement).toBeTruthy();
    });

    expect(screen.getByText(/Grade A - Preferred SACCO/i)).toBeTruthy();
  });

  it('sources safety score from precomputed analytics document if present', async () => {
    const mockPrecomputed = {
      id: 'sacco_sacco_metrolink',
      saccoId: 'sacco_metrolink',
      safetyScore: 91,
      fleetCount: 15,
      unresolvedComplaints: 1,
      updatedAt: '2026-08-13T10:00:00Z',
    };

    vi.spyOn(tripRepository, 'getAll').mockResolvedValue([] as any);
    vi.spyOn(vehicleRepository, 'getAll').mockResolvedValue([] as any);
    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([] as any);
    vi.spyOn(complaintRepository, 'getAll').mockResolvedValue([] as any);
    vi.spyOn(analyticsRepository, 'getById').mockResolvedValue(mockPrecomputed as any);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter>
          <SaccoDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const scoreElement = screen.getByText('91');
      expect(scoreElement).toBeTruthy();
    });

    expect(screen.getByText(/Grade A - Preferred SACCO/i)).toBeTruthy();
  });
});
