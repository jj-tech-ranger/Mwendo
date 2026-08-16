// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { AdminModerationScreen } from '../features/admin/AdminModerationScreen';
import { useAuthStore } from '../store/useAuthStore';
import { violationRepository, auditLogRepository } from '../repositories';
import { ToastProvider } from '../components/ui/Toast';
import { Violation } from '../types';

describe('DATA-001: Admin Moderation Real Firestore Data & Zero Fake Content', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'admin_1',
        uid: 'admin_1',
        email: 'admin@ntsa.go.ke',
        displayName: 'NTSA Administrator',
        role: 'admin',
        activeRole: 'admin',
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

  it('renders real disputed violations from Firestore and contains no hardcoded fake cases', async () => {
    const mockDisputedViolation: Violation = {
      id: 'viol_real_9921',
      saccoId: 'sacco_supermetro',
      vehicleRegNumber: 'KDB 889X',
      driverName: 'Kamau Njoroge',
      routeName: 'Nairobi - Thika Highway',
      recordedSpeedKmH: 104,
      speedLimitKmH: 80,
      severity: 'high',
      confidenceScore: 96,
      isCorroborated: true,
      timestamp: '2026-08-16T09:30:00.000Z',
      status: 'disputed',
      locationName: 'Ruiru Interchange',
    };

    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([mockDisputedViolation]);

    render(
      <ToastProvider>
        <AdminModerationScreen />
      </ToastProvider>
    );

    // Wait for the real disputed violation to appear
    await waitFor(() => {
      expect(screen.getByText('KDB 889X')).toBeTruthy();
    });

    expect(screen.getByText(/104 km\/h/)).toBeTruthy();
    expect(screen.getByText(/Nairobi - Thika Highway/)).toBeTruthy();
    expect(screen.getByText(/Kamau Njoroge/)).toBeTruthy();
    expect(screen.getByText('sacco_supermetro')).toBeTruthy();

    // Verify honest disclosure for community abuse flagging
    expect(
      screen.getByText('Community abuse-flagging is not yet implemented')
    ).toBeTruthy();

    // Assert that hardcoded fake case IDs and disputes DO NOT exist anywhere in rendered DOM
    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('Case #AR-2291');
    expect(bodyText).not.toContain('Case #AR-2292');
    expect(bodyText).not.toContain('Dispute #V-4081');
    expect(bodyText).not.toContain('MetroLink Express');
    expect(bodyText).not.toContain('usr-104');
  });

  it('renders genuine empty state when no disputed violations exist', async () => {
    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([]);

    render(
      <ToastProvider>
        <AdminModerationScreen />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText('No disputed violations pending review')
      ).toBeTruthy();
    });

    expect(
      screen.getByText(/All speed breach recordings and SACCO citations are currently clear of open disputes/i)
    ).toBeTruthy();
  });

  it('allows reviewing and adjudicating a real disputed violation with audit logging', async () => {
    const mockDisputedViolation: Violation = {
      id: 'viol_real_9921',
      saccoId: 'sacco_supermetro',
      vehicleRegNumber: 'KDB 889X',
      driverName: 'Kamau Njoroge',
      routeName: 'Nairobi - Thika Highway',
      recordedSpeedKmH: 104,
      speedLimitKmH: 80,
      severity: 'high',
      confidenceScore: 96,
      isCorroborated: true,
      timestamp: '2026-08-16T09:30:00.000Z',
      status: 'disputed',
      locationName: 'Ruiru Interchange',
    };

    vi.spyOn(violationRepository, 'getAll').mockResolvedValue([mockDisputedViolation]);
    const updateSpy = vi.spyOn(violationRepository, 'update').mockResolvedValue(undefined);
    const auditSpy = vi.spyOn(auditLogRepository, 'save').mockResolvedValue(undefined);

    render(
      <ToastProvider>
        <AdminModerationScreen />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('KDB 889X')).toBeTruthy();
    });

    // Click "Review Dispute"
    fireEvent.click(screen.getByText('Review Dispute'));

    // Should transition to Case Review tab
    await waitFor(() => {
      expect(screen.getByText('DISPUTE: KDB 889X')).toBeTruthy();
    });

    // Try submitting without notes
    const upholdDisputeBtn = screen.getByText('Uphold Dispute (Dismiss Violation)');
    fireEvent.click(upholdDisputeBtn);
    expect(updateSpy).not.toHaveBeenCalled();

    // Enter mandatory resolution notes
    const notesTextarea = screen.getByLabelText(/Adjudication Decision Notes/i);
    fireEvent.change(notesTextarea, {
      target: { value: 'Telemetry confirmed sensor calibration anomaly. Dispute upheld.' },
    });

    // Submit adjudication: Uphold dispute (dismiss violation)
    fireEvent.click(upholdDisputeBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('viol_real_9921', {
        status: 'dismissed',
      });
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          actorRole: 'admin',
          action: 'RESOLVE_VIOLATION_DISPUTE (DISMISSED)',
          target: expect.stringContaining('viol_real_9921'),
        })
      );
    });
  });
});
