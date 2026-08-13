import { describe, it, expect } from 'vitest';
import { PlatformAnalyticsDaily, SaccoAnalyticsDaily } from '../types';
import { AnalyticsRepository, analyticsRepository } from '../repositories';

describe('DM-002: Analytics Types and Repository Validation', () => {
  it('correctly models PlatformAnalyticsDaily conforming to updateDailyAnalytics payload', () => {
    const platformDoc: PlatformAnalyticsDaily = {
      id: 'daily_2026-08-13',
      docId: 'daily_2026-08-13',
      date: '2026-08-13',
      type: 'daily',
      totalTrips: 125,
      totalViolations: 8,
      activeAlerts: 2,
      riskDistribution: {
        low: 80,
        medium: 35,
        high: 8,
        critical: 2,
      },
      updatedAt: '2026-08-13T10:00:00Z',
    };

    expect(platformDoc.id).toBe('daily_2026-08-13');
    expect(platformDoc.totalTrips).toBe(125);
    expect(platformDoc.totalViolations).toBe(8);
    expect(platformDoc.activeAlerts).toBe(2);
    expect(platformDoc.riskDistribution.low).toBe(80);
    expect(platformDoc.riskDistribution.critical).toBe(2);

    // Verify removed legacy fields do NOT exist
    // @ts-expect-error - totalDistanceKm was removed in DM-002
    expect(platformDoc.totalDistanceKm).toBeUndefined();
    // @ts-expect-error - overspeedEvents was removed in DM-002
    expect(platformDoc.overspeedEvents).toBeUndefined();
    // @ts-expect-error - blackspotAlertsTriggered was removed in DM-002
    expect(platformDoc.blackspotAlertsTriggered).toBeUndefined();
    // @ts-expect-error - avgSafetyScore was removed in DM-002
    expect(platformDoc.avgSafetyScore).toBeUndefined();
  });

  it('correctly models SaccoAnalyticsDaily conforming to rebuildSaccoAnalytics payload', () => {
    const saccoDoc: SaccoAnalyticsDaily = {
      id: 'sacco_sacco_metrolink',
      docId: 'sacco_sacco_metrolink',
      saccoId: 'sacco_metrolink',
      type: 'sacco',
      safetyScore: 88,
      fleetCount: 42,
      unresolvedComplaints: 3,
      updatedAt: '2026-08-13T10:00:00Z',
    };

    expect(saccoDoc.id).toBe('sacco_sacco_metrolink');
    expect(saccoDoc.saccoId).toBe('sacco_metrolink');
    expect(saccoDoc.safetyScore).toBe(88);
    expect(saccoDoc.fleetCount).toBe(42);
    expect(saccoDoc.unresolvedComplaints).toBe(3);

    // Verify removed legacy fields do NOT exist
    // @ts-expect-error - totalDistanceKm was removed in DM-002
    expect(saccoDoc.totalDistanceKm).toBeUndefined();
    // @ts-expect-error - avgSafetyScore was removed in DM-002
    expect(saccoDoc.avgSafetyScore).toBeUndefined();
  });

  it('instantiates AnalyticsRepository with AnalyticsDocument union type', () => {
    const repo = new AnalyticsRepository();
    expect(repo).toBeInstanceOf(AnalyticsRepository);
    expect(analyticsRepository).toBeInstanceOf(AnalyticsRepository);
  });
});
