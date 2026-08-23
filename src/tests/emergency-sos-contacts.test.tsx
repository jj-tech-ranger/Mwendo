// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EmergencySosScreen } from '../features/passenger/EmergencySosScreen';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../services/authService';

describe('DATA-002: Emergency SOS Contacts Real Data & Zero Hardcoded Fake Profiles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a genuine empty state when the user has no saved emergency contacts and contains NO fake contacts', async () => {
    useAuthStore.setState({
      user: {
        id: 'user_no_contacts',
        uid: 'user_no_contacts',
        email: 'passenger@mwendo.co.ke',
        displayName: 'Amina Ali',
        role: 'passenger',
        activeRole: 'passenger',
        emergencyContacts: [],
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <EmergencySosScreen />
      </MemoryRouter>
    );

    // Click on the Contacts tab
    const contactsTabBtn = screen.getByRole('button', { name: /Contacts/i });
    fireEvent.click(contactsTabBtn);

    // Verify empty state is rendered
    expect(screen.getByText('No Emergency Contacts Saved')).toBeTruthy();
    expect(
      screen.getByText(/SOS alert effectiveness depends on having trusted contacts saved/i)
    ).toBeTruthy();
    expect(screen.getByText('Add First Emergency Contact')).toBeTruthy();

    // Verify fabricated fake contacts (Mary Wanjiku, Peter Ochieng) DO NOT appear in document
    const bodyContent = document.body.textContent || '';
    expect(bodyContent).not.toContain('Mary Wanjiku');
    expect(bodyContent).not.toContain('Peter Ochieng');
    expect(bodyContent).not.toContain('+254 712 345 678');
    expect(bodyContent).not.toContain('+254 722 987 654');
  });

  it('renders real saved emergency contacts from the authenticated user profile', async () => {
    useAuthStore.setState({
      user: {
        id: 'user_with_contacts',
        uid: 'user_with_contacts',
        email: 'passenger_real@mwendo.co.ke',
        displayName: 'Faith Wambui',
        role: 'passenger',
        activeRole: 'passenger',
        emergencyContacts: [
          { name: 'Alice Mutua', relationship: 'Mother', phone: '+254700112233' },
          { name: 'Brian Koech', relationship: 'Brother', phone: '+254711445566' },
        ],
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <EmergencySosScreen />
      </MemoryRouter>
    );

    // Switch to Contacts tab
    const contactsTabBtn = screen.getByRole('button', { name: /Contacts \(2\)/i });
    fireEvent.click(contactsTabBtn);

    // Assert real saved contacts are displayed
    expect(screen.getByText('Alice Mutua')).toBeTruthy();
    expect(screen.getByText(/Mother/)).toBeTruthy();
    expect(screen.getByText('+254700112233')).toBeTruthy();

    expect(screen.getByText('Brian Koech')).toBeTruthy();
    expect(screen.getByText(/Brother/)).toBeTruthy();
    expect(screen.getByText('+254711445566')).toBeTruthy();

    // Verify Mary Wanjiku and Peter Ochieng are absent
    const bodyContent = document.body.textContent || '';
    expect(bodyContent).not.toContain('Mary Wanjiku');
    expect(bodyContent).not.toContain('Peter Ochieng');
  });

  it('persists a newly added contact via authService.updateProfileData', async () => {
    const updateProfileSpy = vi.spyOn(authService, 'updateProfileData').mockResolvedValue(undefined);

    useAuthStore.setState({
      user: {
        id: 'user_persist_test',
        uid: 'user_persist_test',
        email: 'persist@mwendo.co.ke',
        displayName: 'David Kariuki',
        role: 'passenger',
        activeRole: 'passenger',
        emergencyContacts: [],
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <EmergencySosScreen />
      </MemoryRouter>
    );

    // Switch to Contacts tab
    const contactsTabBtn = screen.getByRole('button', { name: /Contacts/i });
    fireEvent.click(contactsTabBtn);

    // Click "Add First Emergency Contact"
    fireEvent.click(screen.getByText('Add First Emergency Contact'));

    // Fill modal form
    const nameInput = screen.getByPlaceholderText(/Jane Muthoni/i);
    const phoneInput = screen.getByPlaceholderText(/\+254 712 345 678/i);
    const saveBtn = screen.getByRole('button', { name: /Save to Profile/i });

    fireEvent.change(nameInput, { target: { value: 'Samuel Kiprop' } });
    fireEvent.change(phoneInput, { target: { value: '+254799887766' } });

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateProfileSpy).toHaveBeenCalledWith({
        emergencyContacts: [
          {
            name: 'Samuel Kiprop',
            relationship: 'Family',
            phone: '+254799887766',
          },
        ],
      });
    });

    // Verify contact appears on screen
    expect(screen.getByText('Samuel Kiprop')).toBeTruthy();
    expect(screen.getByText('+254799887766')).toBeTruthy();
  });

  describe('CRIT-01: Emergency SOS Real GPS & Active Trip Context Verification', () => {
    it('transmits real GPS and active trip store data in sendSOS payload instead of hardcoded values', async () => {
      vi.useFakeTimers();

      // 1. Mock Geolocation
      const mockGeo = {
        getCurrentPosition: vi.fn().mockImplementation((success) => {
          success({
            coords: {
              latitude: -1.2921,
              longitude: 36.8219,
              accuracy: 5,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: 24,
            },
            timestamp: Date.now(),
          });
        }),
      };
      Object.defineProperty(global.navigator, 'geolocation', {
        value: mockGeo,
        configurable: true,
      });

      // 2. Set active trip in useTripStore
      const { useTripStore } = await import('../store/useTripStore');
      useTripStore.setState({
        activeTrip: {
          id: 'trip_real_123',
          tripId: 'TRIP-999888',
          vehicleRegNumber: 'KDB 345M',
          plateNumber: 'KDB 345M',
          saccoId: 'sacco_metro_express',
          saccoName: 'Metro Express',
          routeName: 'Nairobi - Thika',
          status: 'active',
          currentSpeedKmH: 88,
          maxSpeedKmH: 92,
          avgSpeedKmH: 70,
          startTime: '2026-08-23T10:00:00Z',
          durationSeconds: 1200,
          distanceMeters: 25000,
          overspeedEventsCount: 0,
          violationsCount: 0,
        },
        isTracking: true,
        currentSpeed: 88,
        plateNumber: 'KDB 345M',
      });

      // 3. Set auth store user
      useAuthStore.setState({
        user: {
          id: 'user_active_passenger',
          uid: 'user_active_passenger',
          email: 'commuter@mwendo.co.ke',
          displayName: 'Jane Doe',
          role: 'passenger',
          activeRole: 'passenger',
          saccoId: 'sacco_metro_express',
          emergencyContacts: [
            { name: 'Peter Karanja', relationship: 'Father', phone: '+254700998877' },
          ],
          isActive: true,
          isVerified: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      const { functionsService } = await import('../services/functionsService');
      const sendSosSpy = vi.spyOn(functionsService, 'sendSOS').mockResolvedValue({
        success: true,
        alertId: 'sos_real_test_1',
        contactsNotifiedCount: 1,
        fcmDispatchedCount: 1,
        dlqCount: 0,
        contactsSummary: [
          { name: 'Peter Karanja', relationship: 'Father', status: 'dispatched' },
        ],
      });

      render(
        <MemoryRouter>
          <EmergencySosScreen />
        </MemoryRouter>
      );

      // Trigger SOS
      const sosBtn = screen.getByRole('button', { name: /Tap to Broadcast/i });
      fireEvent.click(sosBtn);

      // Advance countdown (3s)
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      // Verify sendSOS was called with REAL location and REAL trip data (not hardcoded KCE 450Z / 82 km/h / -1.286389)
      expect(sendSosSpy).toHaveBeenCalledTimes(1);
      const calledPayload = sendSosSpy.mock.calls[0]![0];
      expect(calledPayload.location).toEqual({ lat: -1.2921, lng: 36.8219 });
      expect(calledPayload.vehicleRegNumber).toBe('KDB 345M');
      expect(calledPayload.saccoId).toBe('sacco_metro_express');
      expect(calledPayload.speedKmH).toBe(88);
      expect(calledPayload.message).toContain('KDB 345M');

      // Verify UI shows genuine dispatch confirmation
      expect(screen.getByText('Emergency Alert Dispatched')).toBeTruthy();
      expect(screen.getByText(/Sent SMS to Peter Karanja/i)).toBeTruthy();

      vi.useRealTimers();
    });

    it('shows failure backup state and never reports status: dispatched when callable fails with non-rate-limit error', async () => {
      vi.useFakeTimers();

      const mockGeo = {
        getCurrentPosition: vi.fn().mockImplementation((success) => {
          success({
            coords: { latitude: -0.0917, longitude: 34.768 },
            timestamp: Date.now(),
          });
        }),
      };
      Object.defineProperty(global.navigator, 'geolocation', {
        value: mockGeo,
        configurable: true,
      });

      const { useTripStore } = await import('../store/useTripStore');
      useTripStore.setState({ activeTrip: null, isTracking: false, currentSpeed: 0, plateNumber: '' });

      useAuthStore.setState({
        user: {
          id: 'user_fail_test',
          uid: 'user_fail_test',
          email: 'fail@mwendo.co.ke',
          displayName: 'Ochieng',
          role: 'passenger',
          activeRole: 'passenger',
          emergencyContacts: [
            { name: 'Mary Otieno', relationship: 'Sister', phone: '+254711223344' },
          ],
          isActive: true,
          isVerified: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      const { functionsService } = await import('../services/functionsService');
      const sendSosSpy = vi.spyOn(functionsService, 'sendSOS').mockRejectedValue(
        new Error('Network transport offline: Unable to reach Cloud Function')
      );

      render(
        <MemoryRouter>
          <EmergencySosScreen />
        </MemoryRouter>
      );

      const sosBtn = screen.getByRole('button', { name: /Tap to Broadcast/i });
      fireEvent.click(sosBtn);

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      // Verify callable was invoked
      expect(sendSosSpy).toHaveBeenCalledTimes(1);

      // Assert UI shows failure / backup channels active, NOT false success
      expect(screen.getByText('SOS dispatch failed — using backup channels')).toBeTruthy();
      expect(screen.getByText(/Queued — will retry/i)).toBeTruthy();
      expect(screen.queryByText('Emergency Alert Dispatched')).toBeNull();
      expect(screen.queryByText(/Sent SMS to Mary Otieno/i)).toBeNull();

      vi.useRealTimers();
    });

    it('falls back to location unavailable when GPS is denied and no cache exists without fabricating coordinates', async () => {
      vi.useFakeTimers();

      // Geolocation denied error
      const mockGeo = {
        getCurrentPosition: vi.fn().mockImplementation((_success, error) => {
          error({ code: 1, message: 'User denied Geolocation' });
        }),
      };
      Object.defineProperty(global.navigator, 'geolocation', {
        value: mockGeo,
        configurable: true,
      });

      const { useTripStore } = await import('../store/useTripStore');
      useTripStore.setState({ activeTrip: null, isTracking: false, currentSpeed: 0, routeCoordinates: [], plateNumber: '' });

      const { offlineStorage } = await import('../services/offlineStorage');
      vi.spyOn(offlineStorage, 'getItem').mockResolvedValue(null);

      useAuthStore.setState({
        user: {
          id: 'user_no_gps',
          uid: 'user_no_gps',
          email: 'nogps@mwendo.co.ke',
          displayName: 'No GPS User',
          role: 'passenger',
          activeRole: 'passenger',
          emergencyContacts: [],
          isActive: true,
          isVerified: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      const { functionsService } = await import('../services/functionsService');
      const sendSosSpy = vi.spyOn(functionsService, 'sendSOS').mockResolvedValue({
        success: true,
        alertId: 'sos_no_gps_1',
        contactsNotifiedCount: 0,
        fcmDispatchedCount: 1,
        dlqCount: 0,
        contactsSummary: [],
      });

      render(
        <MemoryRouter>
          <EmergencySosScreen />
        </MemoryRouter>
      );

      const sosBtn = screen.getByRole('button', { name: /Tap to Broadcast/i });
      fireEvent.click(sosBtn);

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      expect(sendSosSpy).toHaveBeenCalledTimes(1);
      const payload = sendSosSpy.mock.calls[0]![0];
      // Location MUST be undefined, NOT fabricated -1.286389
      expect(payload.location).toBeUndefined();
      expect(payload.vehicleRegNumber).toBeUndefined();

      expect(screen.getByText(/location unavailable/i)).toBeTruthy();

      vi.useRealTimers();
    });

    it('retains existing rate limit error UX when RATE_LIMIT_EXCEEDED error is encountered', async () => {
      vi.useFakeTimers();

      const { functionsService } = await import('../services/functionsService');
      const rateLimitError = new Error('RATE_LIMIT_EXCEEDED: Maximum 3 SOS alerts permitted per hour.');
      (rateLimitError as any).code = 'RATE_LIMIT_EXCEEDED';
      vi.spyOn(functionsService, 'sendSOS').mockRejectedValue(rateLimitError);

      useAuthStore.setState({
        user: {
          id: 'user_ratelimit',
          uid: 'user_ratelimit',
          email: 'ratelimit@mwendo.co.ke',
          displayName: 'Rate Limited User',
          role: 'passenger',
          activeRole: 'passenger',
          emergencyContacts: [],
          isActive: true,
          isVerified: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isAuthenticated: true,
        isLoading: false,
      });

      render(
        <MemoryRouter>
          <EmergencySosScreen />
        </MemoryRouter>
      );

      const sosBtn = screen.getByRole('button', { name: /Tap to Broadcast/i });
      fireEvent.click(sosBtn);

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      // Verify rate limit banner is displayed and dispatch screen was not reached
      expect(screen.getByText('SOS Dispatch Limit Reached')).toBeTruthy();
      expect(screen.getByText(/Maximum 3 SOS alerts permitted per hour/i)).toBeTruthy();
      expect(screen.queryByText('Emergency Alert Dispatched')).toBeNull();

      vi.useRealTimers();
    });
  });
});
