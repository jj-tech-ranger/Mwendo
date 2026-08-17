// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthorityReportsScreen } from '../features/authority/AuthorityReportsScreen';
import { useAuthStore } from '../store/useAuthStore';
import {
  saccoRepository,
  blackSpotRepository,
  violationRepository,
  tripRepository,
  vehicleRepository,
} from '../repositories';

// Mock charts to render simple containers
vi.mock('../components/charts/Charts', () => ({
  LineChartWrapper: ({ data }: any) => <div data-testid="line-chart">{JSON.stringify(data)}</div>,
  BarChartWrapper: ({ data }: any) => <div data-testid="bar-chart">{JSON.stringify(data)}</div>,
  DonutChartWrapper: ({ data }: any) => <div data-testid="donut-chart">{JSON.stringify(data)}</div>,
}));

describe('DATA-003: AuthorityReportsScreen Dynamic Regulatory Analytics & CSV Export', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    useAuthStore.setState({
      user: {
        id: 'authority_user_1',
        uid: 'authority_user_1',
        email: 'inspector@ntsa.go.ke',
        displayName: 'NTSA Inspector',
        role: 'authority',
        activeRole: 'authority',
        county: 'All Kenya (National)',
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

  it('computes real KPI numbers from repository data instead of hardcoded numbers', async () => {
    const mockSaccos = [
      { id: 'sacco_1', name: '2NK Sacco', fleetCount: 15, safetyScore: 92, registrationCode: '2NK-001', contactPhone: '0700000000', contactEmail: 'info@2nk.co.ke', status: 'active' as const },
      { id: 'sacco_2', name: 'Super Metro', fleetCount: 40, safetyScore: 88, registrationCode: 'SM-001', contactPhone: '0700000001', contactEmail: 'info@supermetro.co.ke', status: 'active' as const },
    ];

    const mockTrips = [
      { id: 'trip_1', vehicleRegNumber: 'KDA 123A', saccoId: 'sacco_1', saccoName: '2NK Sacco', routeName: 'Nairobi - Nyeri', status: 'completed' as const, currentSpeedKmH: 0, maxSpeedKmH: 75, avgSpeedKmH: 60, startTime: new Date(Date.now() - 2 * 86400000).toISOString() },
      { id: 'trip_2', vehicleRegNumber: 'KDB 456B', saccoId: 'sacco_2', saccoName: 'Super Metro', routeName: 'Nairobi - Kikuyu', status: 'completed' as const, currentSpeedKmH: 0, maxSpeedKmH: 95, avgSpeedKmH: 70, startTime: new Date(Date.now() - 3 * 86400000).toISOString() },
      { id: 'trip_3', vehicleRegNumber: 'KDC 789C', saccoId: 'sacco_2', saccoName: 'Super Metro', routeName: 'Nairobi - Juja', status: 'completed' as const, currentSpeedKmH: 0, maxSpeedKmH: 78, avgSpeedKmH: 55, startTime: new Date(Date.now() - 4 * 86400000).toISOString() },
    ];

    const mockViolations = [
      {
        id: 'viol_1',
        saccoId: 'sacco_2',
        vehicleRegNumber: 'KDB 456B',
        driverName: 'John Kamau',
        routeName: 'Nairobi - Kikuyu',
        recordedSpeedKmH: 95,
        speedLimitKmH: 80,
        severity: 'medium' as const,
        confidenceScore: 0.95,
        isCorroborated: true,
        timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
        status: 'pending' as const,
        locationName: 'Waiyaki Way',
      },
    ];

    const mockBlackSpots = [
      { id: 'bs_1', name: 'Salgaa Stretch', routeName: 'Nakuru - Eldoret', county: 'Nakuru', latitude: -0.28, longitude: 35.85, severity: 'critical' as const, hazardType: 'accident_prone' as const, hazardDescription: 'Steep descent', reportedByUid: 'ntsa_1', createdAt: '2026-01-01' },
    ];

    const mockVehicles = [
      { id: 'veh_1', regNumber: 'KDA 123A', saccoId: 'sacco_1', saccoName: '2NK Sacco', capacity: 14, status: 'active' as const, insuranceExpiry: '2026-12-31', inspectionExpiry: '2026-12-31' },
      { id: 'veh_2', regNumber: 'KDB 456B', saccoId: 'sacco_2', saccoName: 'Super Metro', capacity: 33, status: 'active' as const, insuranceExpiry: '2026-12-31', inspectionExpiry: '2026-12-31' },
    ];

    vi.spyOn(saccoRepository, 'getAll').mockResolvedValue(mockSaccos);
    vi.spyOn(blackSpotRepository, 'getAll').mockResolvedValue(mockBlackSpots);
    vi.spyOn(violationRepository, 'getAll').mockResolvedValue(mockViolations);
    vi.spyOn(tripRepository, 'getAll').mockResolvedValue(mockTrips);
    vi.spyOn(vehicleRepository, 'getAll').mockResolvedValue(mockVehicles);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthorityReportsScreen />
      </QueryClientProvider>
    );

    // Wait for query to resolve and check dynamic KPIs
    await waitFor(() => {
      // 3 trips total
      const tripsCard = document.getElementById('kpi-total-trips');
      expect(tripsCard?.textContent).toContain('3');

      // 1 speed violation total (delta: 95 - 80 = 15 km/h -> statutory fine 10,000)
      const violationsCard = document.getElementById('kpi-speed-violations');
      expect(violationsCard?.textContent).toContain('1');

      // Fines should be KES 10.0K or KES 10,000
      const finesCard = document.getElementById('kpi-fines-issued');
      expect(finesCard?.textContent).toMatch(/KES\s*(10\.0K|10,000)/);

      // Compliance rate: 2 clean trips out of 3 = 66.7%
      const complianceCard = document.getElementById('kpi-compliance-rate');
      expect(complianceCard?.textContent).toContain('66.7%');
    });

    // Verify SACCO table renders dynamic names and scores
    expect(screen.getByText('2NK Sacco')).toBeTruthy();
    expect(screen.getByText('Super Metro')).toBeTruthy();
  });

  it('renders genuine zero/empty state when repositories return empty datasets', async () => {
    vi.spyOn(saccoRepository, 'getAll').mockResolvedValue([]);
    vi.spyOn(blackSpotRepository, 'getAll').mockResolvedValue([]);
    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([]);
    vi.spyOn(tripRepository, 'getAll').mockResolvedValue([]);
    vi.spyOn(vehicleRepository, 'getAll').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthorityReportsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      const tripsCard = document.getElementById('kpi-total-trips');
      expect(tripsCard?.textContent).toContain('0');

      const violationsCard = document.getElementById('kpi-speed-violations');
      expect(violationsCard?.textContent).toContain('0');

      const finesCard = document.getElementById('kpi-fines-issued');
      expect(finesCard?.textContent).toContain('KES 0');

      const complianceCard = document.getElementById('kpi-compliance-rate');
      expect(complianceCard?.textContent).toContain('100.0%');
    });

    expect(screen.getByText(/No SACCO safety records found/i)).toBeTruthy();
  });

  it('handles CSV export using dynamically derived dataset without hardcoded numbers', async () => {
    vi.spyOn(saccoRepository, 'getAll').mockResolvedValue([
      { id: 'sacco_1', name: 'Molo Shuttle', fleetCount: 20, safetyScore: 90, registrationCode: 'MS-1', contactPhone: '0700000000', contactEmail: 'info@molo.co.ke', status: 'active' as const },
    ]);
    vi.spyOn(blackSpotRepository, 'getAll').mockResolvedValue([]);
    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([]);
    vi.spyOn(tripRepository, 'getAll').mockResolvedValue([]);
    vi.spyOn(vehicleRepository, 'getAll').mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <AuthorityReportsScreen />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Molo Shuttle')).toBeTruthy();
    });

    const exportBtn = screen.getByRole('button', { name: /Export CSV Data/i });
    expect(exportBtn).toBeTruthy();

    const originalCreateElement = document.createElement.bind(document);
    let capturedHref = '';
    const clickSpy = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        const anchor = el as HTMLAnchorElement;
        const origSetAttribute = anchor.setAttribute.bind(anchor);
        vi.spyOn(anchor, 'setAttribute').mockImplementation((name: string, val: string) => {
          if (name === 'href') {
            capturedHref = val;
          }
          return origSetAttribute(name, val);
        });
        vi.spyOn(anchor, 'click').mockImplementation(clickSpy);
      }
      return el;
    });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });

    const decodedCsv = decodeURIComponent(capturedHref);
    expect(decodedCsv).toContain('Molo Shuttle');
    expect(decodedCsv).toContain('NATIONAL TRANSPORT AND SAFETY AUTHORITY');
    expect(decodedCsv).not.toContain('14,280'); // Hardcoded fake numbers from before must NOT appear
  });
});
