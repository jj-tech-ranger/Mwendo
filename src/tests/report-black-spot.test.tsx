// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportBlackSpotScreen } from '../features/passenger/ReportBlackSpotScreen';
import { functionsService } from '../services/functionsService';
import { useAuthStore } from '../store/useAuthStore';

vi.mock('../services/functionsService', () => ({
  functionsService: {
    reportBlackSpot: vi.fn().mockResolvedValue({ success: true, spotId: 'mock_spot_123' }),
  },
}));

vi.mock('../services/storageService', () => ({
  storageService: {
    uploadBlackSpotPhoto: vi.fn().mockResolvedValue('https://storage.googleapis.com/test.jpg'),
  },
}));

vi.mock('../services/offlineStorage', () => ({
  offlineStorage: {
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/offlineSyncService', () => ({
  offlineSyncService: {
    updatePendingCount: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('ReportBlackSpotScreen (CRIT-02 Geolocation & Pin Drop)', () => {
  const originalGeolocation = navigator.geolocation;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        uid: 'test_user_789',
        id: 'test_user_789',
        displayName: 'Amani Kamau',
        email: 'amani@example.com',
        role: 'passenger',
        activeRole: 'passenger',
      } as any,
    });
  });

  afterEach(() => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
      writable: true,
    });
  });

  it('acquires real GPS coordinates on mount and attaches them to report payload (not hardcoded default)', async () => {
    const mockLat = -1.30921;
    const mockLng = 36.81245;

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: mockLat,
            longitude: mockLng,
            accuracy: 5,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      }),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <ReportBlackSpotScreen />
      </MemoryRouter>
    );

    // Verify GPS acquisition
    await waitFor(() => {
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    });

    const coordsDisplay = await screen.findByTestId('selected-coordinates-display');
    expect(coordsDisplay.textContent).toContain('-1.30921');
    expect(coordsDisplay.textContent).toContain('36.81245');

    // Confirm step 1
    const confirmLocBtn = screen.getByTestId('btn-confirm-location-next') as HTMLButtonElement;
    expect(confirmLocBtn.disabled).toBe(false);
    fireEvent.click(confirmLocBtn);

    // Step 2: Details
    const titleInput = await screen.findByTestId('input-hazard-title');
    fireEvent.change(titleInput, { target: { value: 'Dangerous Unmarked Trench' } });

    const nextDetailsBtn = screen.getByTestId('btn-hazard-details-next');
    fireEvent.click(nextDetailsBtn);

    // Step 3: Severity & Submit
    const submitBtn = (await screen.findByTestId('btn-submit-hazard-report')) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(functionsService.reportBlackSpot).toHaveBeenCalledTimes(1);
    });

    const submittedPayload = vi.mocked(functionsService.reportBlackSpot).mock.calls[0]?.[0] as any;
    expect(submittedPayload).toBeDefined();

    // Assert that coordinates match mock GPS and NOT fabricated default (-1.221, 36.882)
    expect(submittedPayload.latitude).toBeCloseTo(mockLat, 4);
    expect(submittedPayload.longitude).toBeCloseTo(mockLng, 4);
    expect(submittedPayload.location?.lat).toBeCloseTo(mockLat, 4);
    expect(submittedPayload.location?.lng).toBeCloseTo(mockLng, 4);
    expect(submittedPayload.latitude).not.toBe(-1.221);
    expect(submittedPayload.longitude).not.toBe(36.882);
    expect(submittedPayload.title).toBe('Dangerous Unmarked Trench');
    expect(submittedPayload.reportedByUid).toBe('test_user_789');
  });

  it('handles GPS permission denial, displays manual pin drop mode, and disables submit until pin is placed', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((_, error) => {
        error({
          code: 1, // PERMISSION_DENIED
          message: 'User denied Geolocation',
        });
      }),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <ReportBlackSpotScreen />
      </MemoryRouter>
    );

    // Permission denied warning displayed
    await waitFor(() => {
      expect(screen.getByText(/Location permission was denied/i)).toBeTruthy();
    });

    // Step 1 next button must be disabled when no location is set
    const confirmLocBtn = screen.getByTestId('btn-confirm-location-next') as HTMLButtonElement;
    expect(confirmLocBtn.disabled).toBe(true);

    // User drops a pin manually on the map
    const mapWrapper = screen.getByTestId('hazard-map-pin-drop-wrapper');
    fireEvent.click(mapWrapper, { clientX: 100, clientY: 100 });

    // Location is now set
    await waitFor(() => {
      expect(confirmLocBtn.disabled).toBe(false);
    });

    fireEvent.click(confirmLocBtn);

    // Step 2: Details
    const titleInput = await screen.findByTestId('input-hazard-title');
    fireEvent.change(titleInput, { target: { value: 'Oil Spill on Highway' } });

    const nextDetailsBtn = screen.getByTestId('btn-hazard-details-next');
    fireEvent.click(nextDetailsBtn);

    // Step 3: Submit
    const submitBtn = (await screen.findByTestId('btn-submit-hazard-report')) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(functionsService.reportBlackSpot).toHaveBeenCalledTimes(1);
    });

    const submittedPayload = vi.mocked(functionsService.reportBlackSpot).mock.calls[0]?.[0] as any;
    expect(submittedPayload).toBeDefined();
    expect(submittedPayload.latitude).toBeDefined();
    expect(submittedPayload.longitude).toBeDefined();
    expect(submittedPayload.latitude).not.toBe(-1.221);
    expect(submittedPayload.longitude).not.toBe(36.882);
    expect(submittedPayload.title).toBe('Oil Spill on Highway');
  });
});

