// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { ToastProvider } from '../components/ui/Toast';
import { AuthorityDashboard } from '../features/authority/AuthorityDashboard';
import { AuthorityEmergencyScreen } from '../features/authority/AuthorityEmergencyScreen';
import { alertRepository, auditLogRepository } from '../repositories';
import { useAuthStore } from '../store/useAuthStore';
import { SafetyAlert } from '../types';

// Mock charts and map to keep rendering lightweight
vi.mock('../components/charts/Charts', () => ({
  AreaChartWrapper: () => <div data-testid="area-chart" />,
  BarChartWrapper: () => <div data-testid="bar-chart" />,
}));

vi.mock('../components/map/MapComponent', () => ({
  MapComponent: ({ markers }: { markers: any[] }) => (
    <div data-testid="map-component" data-marker-count={markers?.length || 0} />
  ),
}));

describe('SEC-004: Authority Real-Time Safety Alerts Feed & Collection Guard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
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

  it('verifies that AlertRepository canonical collection name is strictly "safety_alerts"', () => {
    expect(alertRepository.collectionName).toBe('safety_alerts');
    expect(alertRepository.getCollectionName()).toBe('safety_alerts');
  });

  it('verifies that static source code for Authority screens has zero references to unmapped "alerts" collection', () => {
    const dashboardSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/authority/AuthorityDashboard.tsx'),
      'utf8'
    );
    const emergencySrc = fs.readFileSync(
      path.resolve(__dirname, '../features/authority/AuthorityEmergencyScreen.tsx'),
      'utf8'
    );

    // Ensure neither file queries the unruled / permission-denied collection('alerts')
    expect(dashboardSrc).not.toMatch(/collection\s*\(\s*db\s*,\s*['"]alerts['"]\s*\)/);
    expect(emergencySrc).not.toMatch(/collection\s*\(\s*db\s*,\s*['"]alerts['"]\s*\)/);

    // Ensure both files invoke alertRepository.subscribeToActive for centralized real-time safety_alerts access
    expect(dashboardSrc).toContain('alertRepository.subscribeToActive');
    expect(emergencySrc).toContain('alertRepository.subscribeToActive');
  });

  it('verifies AuthorityDashboard receives live active safety alerts and renders updated count and map marker', async () => {
    let activeAlertCallback: ((alerts: SafetyAlert[]) => void) | null = null;

    const subscribeSpy = vi.spyOn(alertRepository, 'subscribeToActive').mockImplementation(
      (onAlerts, _onError, limitCount) => {
        expect(limitCount).toBe(50);
        activeAlertCallback = onAlerts;
        return vi.fn(); // Unsubscribe mock
      }
    );

    render(
      <QueryClientProvider client={queryClient}>
        <AuthorityDashboard />
      </QueryClientProvider>
    );

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(activeAlertCallback).toBeTruthy();

    const mockAlerts: SafetyAlert[] = [
      {
        id: 'alert-sos-101',
        tripId: 'trip-101',
        saccoId: '2NK-SACCO',
        vehicleRegNumber: 'KDA 789X',
        driverName: 'Kamau Mwangi',
        type: 'sos',
        severity: 'critical',
        message: 'Collision risk reported in Nairobi',
        speedKmH: 88,
        latitude: -1.286389,
        longitude: 36.817223,
        timestamp: '2026-09-12T12:00:00Z',
        status: 'active',
      },
    ];

    // Simulate real-time snapshot event
    await act(async () => {
      activeAlertCallback!(mockAlerts);
    });

    // Check that map component reflects the incoming alert marker
    await waitFor(() => {
      const mapEl = screen.getByTestId('map-component');
      expect(Number(mapEl.getAttribute('data-marker-count'))).toBeGreaterThan(0);
    });
  });

  it('verifies AuthorityEmergencyScreen receives live safety alerts and displays emergency cards', async () => {
    let emergencyAlertCallback: ((alerts: SafetyAlert[]) => void) | null = null;

    const subscribeSpy = vi.spyOn(alertRepository, 'subscribeToActive').mockImplementation(
      (onAlerts, _onError, limitCount) => {
        expect(limitCount).toBe(50);
        emergencyAlertCallback = onAlerts;
        return vi.fn();
      }
    );

    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthorityEmergencyScreen />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    const mockEmergencyAlerts: SafetyAlert[] = [
      {
        id: 'emergency-sos-202',
        tripId: 'trip-202',
        saccoId: 'SUPER-METRO',
        vehicleRegNumber: 'KDB 999Y',
        driverName: 'John Doe',
        type: 'sos',
        severity: 'critical',
        message: 'Severe vehicle roll warning on Waiyaki Way',
        speedKmH: 105,
        latitude: -1.26,
        longitude: 36.80,
        timestamp: '2026-09-12T12:05:00Z',
        status: 'active',
      },
    ];

    await act(async () => {
      emergencyAlertCallback!(mockEmergencyAlerts);
    });

    await waitFor(() => {
      expect(screen.getByText(/KDB 999Y/i)).toBeTruthy();
      expect(screen.getByText(/Severe vehicle roll warning on Waiyaki Way/i)).toBeTruthy();
    });
  });

  it('verifies that dispatching action in AuthorityEmergencyScreen resolves the alert via alertRepository.update', async () => {
    let emergencyAlertCallback: ((alerts: SafetyAlert[]) => void) | null = null;

    vi.spyOn(alertRepository, 'subscribeToActive').mockImplementation((onAlerts) => {
      emergencyAlertCallback = onAlerts;
      return vi.fn();
    });

    const updateAlertSpy = vi.spyOn(alertRepository, 'update').mockResolvedValue();
    const saveAuditSpy = vi.spyOn(auditLogRepository, 'save').mockResolvedValue();

    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthorityEmergencyScreen />
        </ToastProvider>
      </MemoryRouter>
    );

    const mockAlert: SafetyAlert = {
      id: 'alert-to-resolve-1',
      tripId: 'trip-303',
      saccoId: '4N-SACCO',
      vehicleRegNumber: 'KCC 111Z',
      type: 'sos',
      severity: 'critical',
      message: 'Highway breakdown on Nairobi-Nakuru Highway',
      speedKmH: 0,
      latitude: -0.9,
      longitude: 36.5,
      timestamp: '2026-09-12T12:10:00Z',
      status: 'active',
    };

    await act(async () => {
      emergencyAlertCallback!([mockAlert]);
    });

    await waitFor(() => {
      expect(screen.getByText(/KCC 111Z/i)).toBeTruthy();
    });

    // Open modal by clicking "Dispatch Highway Patrol"
    const openModalBtn = screen.getByRole('button', { name: /Dispatch Highway Patrol/i });
    fireEvent.click(openModalBtn);

    // Click "Dispatch Kenya Police Highway Unit" in the modal
    const dispatchBtn = screen.getByRole('button', { name: /Dispatch Kenya Police Highway Unit/i });
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(updateAlertSpy).toHaveBeenCalledWith('alert-to-resolve-1', {
        acknowledgedByAuthority: true,
        status: 'resolved',
      });
      expect(saveAuditSpy).toHaveBeenCalled();
    });
  });
});
