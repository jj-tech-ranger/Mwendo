import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TripSummaryScreen } from '../features/passenger/TripSummaryScreen';
import { Trip } from '../types';

vi.mock('../lib/firebase', () => ({
  functions: {},
  auth: { currentUser: { uid: 'test-user-123' } },
  db: {},
}));

const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: () => mockHttpsCallable,
}));

vi.mock('../services/pointsService', () => ({
  pointsService: {
    awardPoints: vi.fn().mockResolvedValue(15),
  },
}));

vi.mock('../store/useAuthStore', () => ({
  useAuthStore: (selector: any) =>
    selector({
      user: { uid: 'test-user-123', displayName: 'Faith Njeri' },
      isAuthenticated: true,
    }),
}));

const sampleTrip: Trip = {
  id: 'trip-999',
  userId: 'test-user-123',
  plateNumber: 'KDA 789X',
  vehicleRegNumber: 'KDA 789X',
  saccoId: 'sacco-2nk',
  saccoName: '2NK Sacco',
  routeName: 'Nairobi - Nyeri',
  status: 'completed',
  currentSpeedKmH: 0,
  maxSpeedKmH: 78,
  avgSpeedKmH: 65,
  startTime: '2026-09-01T08:00:00Z',
  endTime: '2026-09-01T10:00:00Z',
  durationSeconds: 7200,
  distanceMeters: 140000,
  overspeedEventsCount: 0,
  violationsCount: 0,
};

describe('TripSummaryScreen truth-in-reporting & dynamic assessment labeling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Safety Assessment" and no generative claims when backend returns rule_engine', async () => {
    mockHttpsCallable.mockResolvedValueOnce({
      data: {
        success: true,
        summary: 'This trip maintained compliant driving speeds along Nairobi - Nyeri with 0 recorded violations — low risk.',
        riskTier: 'low',
        overspeedEventsCount: 0,
        generatedBy: 'rule_engine',
      },
    });

    render(
      <MemoryRouter>
        <TripSummaryScreen trip={sampleTrip} />
      </MemoryRouter>
    );

    // Initial loading indicator must not mention "Gemini"
    expect(screen.queryByText(/Gemini/i)).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('Safety Assessment')).toBeDefined();
    });

    // Must NOT claim "AI Safety Assessment"
    expect(screen.queryByText('AI Safety Assessment')).toBeNull();
    // Must NOT contain "Gemini" anywhere in the document
    expect(document.body.textContent).not.toContain('Gemini');
    expect(screen.getByText(/This trip maintained compliant driving speeds/)).toBeDefined();
  });

  it('truthfully renders "AI Safety Assessment" only if backend returns generatedBy: gemini', async () => {
    mockHttpsCallable.mockResolvedValueOnce({
      data: {
        success: true,
        summary: 'Generative model summary of trip telemetry.',
        riskTier: 'low',
        overspeedEventsCount: 0,
        generatedBy: 'gemini',
      },
    });

    render(
      <MemoryRouter>
        <TripSummaryScreen trip={sampleTrip} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('AI Safety Assessment')).toBeDefined();
    });

    expect(screen.getByText('Generative model summary of trip telemetry.')).toBeDefined();
  });

  it('uses deterministic fallback with "Safety Assessment" label when callable fails', async () => {
    mockHttpsCallable.mockRejectedValueOnce(new Error('Network unavailable'));

    render(
      <MemoryRouter>
        <TripSummaryScreen trip={sampleTrip} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Safety Assessment')).toBeDefined();
    });

    expect(screen.queryByText('AI Safety Assessment')).toBeNull();
    expect(screen.getByText(/Deterministic safety analysis active/i)).toBeDefined();
    expect(document.body.textContent).not.toContain('Gemini');
  });

  it('renders "No Trip Data Available" honest empty state when accessed directly without trip data', async () => {
    render(
      <MemoryRouter>
        <TripSummaryScreen trip={null} />
      </MemoryRouter>
    );

    expect(screen.getByText('No Trip Data Available')).toBeDefined();
    expect(screen.getByText(/No active or completed trip details were found/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /view trip history/i })).toBeDefined();
    expect(screen.queryByText(/KDB 892J/)).toBeNull();
    expect(screen.queryByText(/Super Metro SACCO/)).toBeNull();
  });
});
