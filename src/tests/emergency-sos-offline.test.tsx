import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { EmergencySosScreen } from '../features/passenger/EmergencySosScreen';
import { useAuthStore } from '../store/useAuthStore';
import { offlineStorage } from '../services/offlineStorage';
import { offlineSyncService } from '../services/offlineSyncService';
import { functionsService } from '../services/functionsService';

describe('Emergency SOS Offline & Queued Behavior Verification', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(async () => {
    await offlineStorage.clear();
    useAuthStore.setState({
      user: {
        id: 'user_test_123',
        uid: 'user_test_123',
        displayName: 'John Kamau',
        role: 'passenger',
        emergencyContacts: [
          {
            name: 'Jane Kamau',
            relationship: 'Spouse',
            phone: '+254712345678',
          },
        ],
      } as any,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalOnLine,
    });
    vi.restoreAllMocks();
  });

  it('immediately queues alert and displays clear offline state when triggering SOS while offline', async () => {
    // Set offline mode
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    const sendSosSpy = vi.spyOn(functionsService, 'sendSOS');

    render(
      <BrowserRouter>
        <EmergencySosScreen />
      </BrowserRouter>
    );

    // Initial state: Big Red SOS Button is present
    const sosButton = screen.getByText('SOS');
    expect(sosButton).toBeDefined();

    // Trigger SOS
    fireEvent.click(sosButton);

    // Wait for dispatch execution (countdown is bypassed if countdown state handles it or on direct fire)
    // In EmergencySosScreen, handleTriggerSos sets countdown to 3.
    // Or if countdown finishes, it dispatches. Let's see: handleTriggerSos sets countdown = 3.
    // We can advance timers or cancel / confirm.
    // Let's check: "Send Immediately (Skip Countdown)" button appears during countdown!
    const skipBtn = await screen.findByText(/Send Immediately/i);
    expect(skipBtn).toBeDefined();
    fireEvent.click(skipBtn);

    // Should NOT call remote sendSOS because navigator.onLine is false
    expect(sendSosSpy).not.toHaveBeenCalled();

    // Verify offline-safe card is displayed
    const offlineCard = await screen.findByTestId('sos-offline-card');
    expect(offlineCard).toBeDefined();

    // Verify title and badge explicitly state queued/offline — never false "help on the way"
    const title = screen.getByTestId('sos-offline-title');
    expect(title.textContent).toContain('SOS Queued: Will Send When Back Online');

    const badge = screen.getByTestId('badge-sos-offline-status');
    expect(badge.textContent).toContain('SOS Queued (Offline)');

    // Verify direct-dial button for validated emergency contact exists with tel: link
    const dialContactBtn = screen.getByTestId('btn-dial-primary-contact');
    expect(dialContactBtn).toBeDefined();
    expect(dialContactBtn.getAttribute('href')).toBe('tel:+254712345678');
    expect(dialContactBtn.textContent).toContain('Jane Kamau');

    // Verify hotline links
    const policeLink = screen.getByTestId('btn-dial-police');
    expect(policeLink.getAttribute('href')).toBe('tel:999');

    const ntsaLink = screen.getByTestId('btn-dial-ntsa');
    expect(ntsaLink.getAttribute('href')).toBe('tel:0800720822');

    // Verify retry button exists
    const retryBtn = screen.getByTestId('btn-retry-sos');
    expect(retryBtn).toBeDefined();

    // Verify queued item exists in offline storage
    const allKeys = await offlineStorage.keys();
    const queuedSosKey = allKeys.find((k) => k.startsWith('offline_sos_'));
    expect(queuedSosKey).toBeDefined();

    const storedItem = await offlineStorage.getItem<any>(queuedSosKey!);
    expect(storedItem.type).toBe('sos');
    expect(storedItem.status).toBe('queued');
  });

  it('OfflineSyncService drains queued SOS alerts via functionsService.sendSOS when online', async () => {
    const alertId = 'sos_queued_test_999';
    await offlineStorage.setItem(`offline_sos_${alertId}`, {
      alertId,
      userId: 'user_test_123',
      vehicleRegNumber: 'KDB 456C',
      saccoId: 'sacco_metro',
      message: 'EMERGENCY SOS: Offline queued test',
      timestamp: new Date().toISOString(),
      type: 'sos',
      status: 'queued',
      retryCount: 0,
    });

    const sendSosSpy = vi.spyOn(functionsService, 'sendSOS').mockResolvedValue({
      success: true,
      alertId,
      contactsNotifiedCount: 1,
      fcmDispatchedCount: 2,
      dlqCount: 0,
      contactsSummary: [{ name: 'Jane Kamau', relationship: 'Spouse', status: 'dispatched' }],
    });

    const drainResult = await offlineSyncService.drainQueue();

    expect(sendSosSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId,
        vehicleRegNumber: 'KDB 456C',
      })
    );
    expect(drainResult.syncedSos).toBe(1);

    // Item should be removed from offline storage
    const remainingKeys = await offlineStorage.keys();
    expect(remainingKeys.find((k) => k.includes(alertId))).toBeUndefined();
  });
});
