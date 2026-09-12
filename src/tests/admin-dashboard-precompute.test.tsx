// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminDashboard } from '../features/admin/AdminDashboard';
import {
  analyticsRepository,
  auditLogRepository,
  complaintRepository,
  userRepository,
  saccoRepository,
  tripRepository,
} from '../repositories';
import { PlatformAnalyticsDaily, AuditLog, Complaint } from '../types';

describe('BUG-005: Admin Dashboard Precomputed Reads & Zero Full-Collection Scans', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          staleTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders stats from precomputed daily analytics document without triggering full-collection scans on any of the 5 collections', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    const mockAnalyticsDoc: PlatformAnalyticsDaily = {
      id: `daily_${todayStr}`,
      docId: `daily_${todayStr}`,
      date: todayStr,
      type: 'daily',
      totalTrips: 42,
      totalViolations: 3,
      activeAlerts: 1,
      riskDistribution: { low: 30, medium: 10, high: 2, critical: 0 },
      userCount: 150,
      saccoCount: 12,
      auditLogCount: 88,
      complaintCount: 5,
      updatedAt: new Date().toISOString(),
    };

    const mockRecentLogs: AuditLog[] = [
      {
        id: 'log_1',
        actorName: 'System Administrator',
        actorRole: 'admin',
        action: 'UPDATE_PLATFORM_POLICY',
        target: 'Platform Policy',
        timestamp: new Date().toISOString(),
        saccoId: 'sacco_metro',
      },
    ];

    const mockRecentComplaints: Complaint[] = [
      {
        id: 'comp_1',
        title: 'Reckless overtaking on Thika Road',
        description: 'Vehicle overtook dangerously near Safari Park',
        vehicleRegNumber: 'KDA 123A',
        status: 'open',
        saccoId: 'sacco_metro',
        createdAt: new Date().toISOString(),
      },
    ];

    // Spy on analytics point read and bounded recent feeds
    const getByIdSpy = vi.spyOn(analyticsRepository, 'getById').mockResolvedValue(mockAnalyticsDoc);
    const getRecentLogsSpy = vi.spyOn(auditLogRepository, 'getRecent').mockResolvedValue(mockRecentLogs);
    const getRecentComplaintsSpy = vi.spyOn(complaintRepository, 'getRecentPending').mockResolvedValue(mockRecentComplaints);

    // Spy on the 5 full-collection scan methods to prove ZERO calls
    const userGetAllSpy = vi.spyOn(userRepository, 'getAll');
    const saccoGetAllSpy = vi.spyOn(saccoRepository, 'getAll');
    const tripGetAllSpy = vi.spyOn(tripRepository, 'getAll');
    const auditLogGetAllSpy = vi.spyOn(auditLogRepository, 'getAll');
    const complaintGetAllSpy = vi.spyOn(complaintRepository, 'getAll');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify stats from precomputed document are displayed
    await waitFor(() => {
      expect(screen.getByText('150')).toBeTruthy(); // Total Users
    });

    expect(screen.getByText('12')).toBeTruthy(); // Active SACCOs
    expect(screen.getByText('42')).toBeTruthy(); // Total Tracked Trips
    expect(screen.getByText('5')).toBeTruthy(); // Pending Moderation count
    expect(screen.getByText(/5 Pending Reviews/)).toBeTruthy(); // Moderation queue badge

    // Verify recent log & complaint are rendered in their respective snapshots
    expect(screen.getByText('System Administrator')).toBeTruthy();
    expect(screen.getByText('UPDATE_PLATFORM_POLICY')).toBeTruthy();
    expect(screen.getByText('KDA 123A')).toBeTruthy();
    expect(screen.getByText('Vehicle overtook dangerously near Safari Park')).toBeTruthy();

    // STRICT GUARANTEE: Zero full-collection scans executed on any of the five collections
    expect(userGetAllSpy).not.toHaveBeenCalled();
    expect(saccoGetAllSpy).not.toHaveBeenCalled();
    expect(tripGetAllSpy).not.toHaveBeenCalled();
    expect(auditLogGetAllSpy).not.toHaveBeenCalled();
    expect(complaintGetAllSpy).not.toHaveBeenCalled();

    // Verify only point read and bounded limit queries were executed
    expect(getByIdSpy).toHaveBeenCalledWith(`daily_${todayStr}`);
    expect(getRecentLogsSpy).toHaveBeenCalledWith(5);
    expect(getRecentComplaintsSpy).toHaveBeenCalledWith(3);
  });

  it('falls back to yesterday precomputed document when today document is not yet generated, without full-collection scans', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const mockYesterdayDoc: PlatformAnalyticsDaily = {
      id: `daily_${yesterdayStr}`,
      docId: `daily_${yesterdayStr}`,
      date: yesterdayStr,
      type: 'daily',
      totalTrips: 28,
      totalViolations: 1,
      activeAlerts: 0,
      riskDistribution: { low: 20, medium: 8, high: 0, critical: 0 },
      userCount: 95,
      saccoCount: 8,
      auditLogCount: 50,
      complaintCount: 2,
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(analyticsRepository, 'getById').mockImplementation(async (id: string) => {
      if (id === `daily_${todayStr}`) return null;
      if (id === `daily_${yesterdayStr}`) return mockYesterdayDoc;
      return null;
    });
    vi.spyOn(auditLogRepository, 'getRecent').mockResolvedValue([]);
    vi.spyOn(complaintRepository, 'getRecentPending').mockResolvedValue([]);

    const userGetAllSpy = vi.spyOn(userRepository, 'getAll');
    const saccoGetAllSpy = vi.spyOn(saccoRepository, 'getAll');
    const tripGetAllSpy = vi.spyOn(tripRepository, 'getAll');
    const auditLogGetAllSpy = vi.spyOn(auditLogRepository, 'getAll');
    const complaintGetAllSpy = vi.spyOn(complaintRepository, 'getAll');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('95')).toBeTruthy();
    });

    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('28')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    // Zero full-collection scans
    expect(userGetAllSpy).not.toHaveBeenCalled();
    expect(saccoGetAllSpy).not.toHaveBeenCalled();
    expect(tripGetAllSpy).not.toHaveBeenCalled();
    expect(auditLogGetAllSpy).not.toHaveBeenCalled();
    expect(complaintGetAllSpy).not.toHaveBeenCalled();
  });

  it('renders graceful zero state without querying full collections when neither today nor yesterday document exists', async () => {
    vi.spyOn(analyticsRepository, 'getById').mockResolvedValue(null);
    vi.spyOn(auditLogRepository, 'getRecent').mockResolvedValue([]);
    vi.spyOn(complaintRepository, 'getRecentPending').mockResolvedValue([]);

    const userGetAllSpy = vi.spyOn(userRepository, 'getAll');
    const saccoGetAllSpy = vi.spyOn(saccoRepository, 'getAll');
    const tripGetAllSpy = vi.spyOn(tripRepository, 'getAll');
    const auditLogGetAllSpy = vi.spyOn(auditLogRepository, 'getAll');
    const complaintGetAllSpy = vi.spyOn(complaintRepository, 'getAll');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // All stats show 0 cleanly
    await waitFor(() => {
      expect(screen.getByText(/Mwendo Salama Platform Operations & Control/)).toBeTruthy();
    });

    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(4);

    // Zero full-collection scans even on rare missing day
    expect(userGetAllSpy).not.toHaveBeenCalled();
    expect(saccoGetAllSpy).not.toHaveBeenCalled();
    expect(tripGetAllSpy).not.toHaveBeenCalled();
    expect(auditLogGetAllSpy).not.toHaveBeenCalled();
    expect(complaintGetAllSpy).not.toHaveBeenCalled();
  });
});
