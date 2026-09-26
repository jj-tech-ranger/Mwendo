// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RecentTrips } from '../features/passenger/components/RecentTrips';
import { computeTripSafety } from '../lib/tripSafety';
import { Trip } from '../types';
import * as repositories from '../repositories';
import * as authStore from '../store/useAuthStore';

describe('RecentTrips Dashboard Component', () => {
  let queryClient: QueryClient;

  const mockUser = {
    uid: 'user_123',
    email: 'passenger@example.com',
    role: 'passenger',
  };

  const sampleCompletedTrips: Trip[] = [
    {
      id: 'trip_1',
      vehicleRegNumber: 'KCA 123A',
      saccoId: 'sacco_1',
      saccoName: 'Super Metro',
      routeName: 'Thika Road – CBD',
      status: 'completed',
      currentSpeedKmH: 0,
      maxSpeedKmH: 72,
      avgSpeedKmH: 45,
      startTime: '2026-09-25T10:00:00Z',
      endTime: '2026-09-25T10:45:00Z',
      overspeedEventsCount: 0,
      violationsCount: 0,
      userId: 'user_123',
    },
    {
      id: 'trip_2',
      vehicleRegNumber: 'KBZ 999B',
      saccoId: 'sacco_2',
      saccoName: '2NK Sacco',
      routeName: 'Waiyaki Way – Westlands',
      status: 'completed',
      currentSpeedKmH: 0,
      maxSpeedKmH: 94,
      avgSpeedKmH: 58,
      startTime: '2026-09-24T14:00:00Z',
      endTime: '2026-09-24T14:40:00Z',
      overspeedEventsCount: 2,
      violationsCount: 2,
      userId: 'user_123',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    queryClient.clear();

    vi.spyOn(authStore, 'useAuthStore').mockImplementation((selector: any) =>
      selector({ user: mockUser })
    );
  });

  it('computes accurate safety scores and summaries across risk profiles', () => {
    const compliantSafety = computeTripSafety(sampleCompletedTrips[0]!);
    expect(compliantSafety.score).toBe(96);
    expect(compliantSafety.riskTier).toBe('low');
    expect(compliantSafety.isSafe).toBe(true);
    expect(compliantSafety.summary).toContain('Maintained compliant speeds');

    const moderateSafety = computeTripSafety(sampleCompletedTrips[1]!);
    expect(moderateSafety.score).toBeLessThan(96);
    expect(moderateSafety.riskTier).toBe('moderate');
    expect(moderateSafety.isSafe).toBe(false);
    expect(moderateSafety.summary).toContain('Recorded 2 overspeed event');
  });

  it('fetches and displays user completed trips from Firestore with safety score and generated summary', async () => {
    vi.spyOn(repositories.tripRepository, 'getAll').mockResolvedValue(sampleCompletedTrips);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RecentTrips />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Recent Trips')).toBeTruthy();
      expect(screen.getByText('KCA 123A')).toBeTruthy();
      expect(screen.getByText('KBZ 999B')).toBeTruthy();
    });

    // Verify Safety Scores are displayed
    expect(screen.getByText('96')).toBeTruthy();

    // Verify Generated Summaries are shown
    expect(screen.getByText(/Maintained compliant speeds/i)).toBeTruthy();
    expect(screen.getByText(/Recorded 2 overspeed event/i)).toBeTruthy();
  });

  it('renders an empty state when user has no completed trips', async () => {
    vi.spyOn(repositories.tripRepository, 'getAll').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RecentTrips />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('No completed trips yet')).toBeTruthy();
    });
  });

  it('opens details modal when a trip card is clicked', async () => {
    vi.spyOn(repositories.tripRepository, 'getAll').mockResolvedValue(sampleCompletedTrips);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RecentTrips />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('KCA 123A')).toBeTruthy();
    });

    const tripCard = screen.getByTestId('recent-trip-item-trip_1');
    fireEvent.click(tripCard);

    await waitFor(() => {
      expect(screen.getByText('Generated Safety Summary')).toBeTruthy();
      expect(screen.getByText('Peak Speed')).toBeTruthy();
    });
  });
});
