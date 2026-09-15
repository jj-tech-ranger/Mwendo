// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SaccoViolationsScreen } from '../features/sacco/SaccoViolationsScreen';
import { useAuthStore } from '../store/useAuthStore';
import { violationRepository } from '../repositories';
import '../services/i18n';

describe('SaccoViolationsScreen (UI-014: Honest Empty State and Confidence Score Display)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    useAuthStore.setState({
      user: {
        id: 'mgr_1',
        uid: 'mgr_1',
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

  it('renders honest empty state when violations array is empty without fabricating clean record or crashing', async () => {
    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <SaccoViolationsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No Violations Recorded')).toBeDefined();
    });

    expect(
      screen.getByText('No violations recorded in the selected period.')
    ).toBeDefined();
    expect(screen.queryByText('95%')).toBeNull();
  });

  it('renders "Not available" and "—" risk weight when confidenceScore is absent/undefined rather than 95%', async () => {
    const mockViolation = {
      id: 'viol_101',
      violationId: 'VIO-2026-101',
      saccoId: 'sacco_metrolink',
      vehicleRegNumber: 'KDA 123A',
      driverName: 'John Kamau',
      recordedSpeedKmH: 104,
      speedLimitKmH: 80,
      locationName: 'Waiyaki Way / Westlands',
      severity: 'high' as const,
      isCorroborated: true,
      timestamp: '2026-03-01T10:00:00Z',
      // Notice: confidenceScore is omitted / undefined
    };

    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([mockViolation as any]);

    render(
      <QueryClientProvider client={queryClient}>
        <SaccoViolationsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('VIO-2026-101')).toBeDefined();
    });

    // Click details button to open modal
    const detailsButton = screen.getByRole('button', { name: /details/i });
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(screen.getByText('Violation Report: VIO-2026-101')).toBeDefined();
    });

    // Verification confidence should say "Not available" — NOT 95%!
    expect(screen.getByText(/Verification Confidence:\s*Not available/i)).toBeDefined();
    expect(screen.getByText(/\(Risk Weight:\s*—\)/i)).toBeDefined();
    expect(screen.queryByText(/95%/)).toBeNull();
    expect(screen.queryByText(/0\.95x/)).toBeNull();
  });

  it('renders real percentage and risk weight when confidenceScore is present on record', async () => {
    const mockViolation = {
      id: 'viol_102',
      violationId: 'VIO-2026-102',
      saccoId: 'sacco_metrolink',
      vehicleRegNumber: 'KDB 456B',
      driverName: 'Alice Mwangi',
      recordedSpeedKmH: 95,
      speedLimitKmH: 80,
      locationName: 'Thika Superhighway / Roysambu',
      severity: 'medium' as const,
      isCorroborated: false,
      confidenceScore: 0.88,
      timestamp: '2026-03-01T12:00:00Z',
    };

    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([mockViolation as any]);

    render(
      <QueryClientProvider client={queryClient}>
        <SaccoViolationsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('VIO-2026-102')).toBeDefined();
    });

    // Click details button to open modal
    const detailsButton = screen.getByRole('button', { name: /details/i });
    fireEvent.click(detailsButton);

    await waitFor(() => {
      expect(screen.getByText('Violation Report: VIO-2026-102')).toBeDefined();
    });

    expect(screen.getByText(/Verification Confidence:\s*88%/i)).toBeDefined();
    expect(screen.getByText(/\(Risk Weight:\s*0\.88x\)/i)).toBeDefined();
  });

  it('renders filtered empty state when search term matches no violations', async () => {
    const mockViolation = {
      id: 'viol_103',
      violationId: 'VIO-2026-103',
      saccoId: 'sacco_metrolink',
      vehicleRegNumber: 'KDC 789C',
      driverName: 'Peter Omondi',
      recordedSpeedKmH: 90,
      speedLimitKmH: 80,
      locationName: 'Mombasa Road',
      severity: 'medium' as const,
      isCorroborated: true,
      timestamp: '2026-03-01T14:00:00Z',
    };

    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([mockViolation as any]);

    render(
      <QueryClientProvider client={queryClient}>
        <SaccoViolationsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('VIO-2026-103')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText('Filter by plate number or violation ID...');
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });

    await waitFor(() => {
      expect(screen.getByText('No Matching Violations')).toBeDefined();
    });

    expect(screen.getByText('No recorded violations match "NONEXISTENT".')).toBeDefined();
  });
});
