// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReportBlackSpotScreen } from '../features/passenger/ReportBlackSpotScreen';
import { functionsService } from '../services/functionsService';
import { useAuthStore } from '../store/useAuthStore';
import { offlineStorage } from '../services/offlineStorage';
import { offlineSyncService } from '../services/offlineSyncService';

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

describe('ReportBlackSpotScreen (PROMPT 10 Offline-Queued vs Transmitted Confirmation)', () => {
  const originalGeolocation = navigator.geolocation;
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        uid: 'passenger_101',
        id: 'passenger_101',
        displayName: 'Wanjiku Mwangi',
        email: 'wanjiku@example.com',
        role: 'passenger',
        activeRole: 'passenger',
      } as any,
    });

    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: -1.286389,
            longitude: 36.817223,
            accuracy: 10,
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
  });

  afterEach(() => {
    Object.defineProperty(global.navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global.navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
      writable: true,
    });
  });

  it('renders honest online submission confirmation with transmitted status when online succeeds', async () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    vi.mocked(functionsService.reportBlackSpot).mockResolvedValueOnce({
      success: true,
      spotId: 'bs_server_ok',
    });

    render(
      <MemoryRouter>
        <ReportBlackSpotScreen />
      </MemoryRouter>
    );

    // Step 1: Confirm Location
    const confirmLocBtn = await screen.findByTestId('btn-confirm-location-next');
    fireEvent.click(confirmLocBtn);

    // Step 2: Fill Title & Details
    const titleInput = await screen.findByTestId('input-hazard-title');
    fireEvent.change(titleInput, { target: { value: 'Deep Pothole at Westlands Roundabout' } });
    const nextDetailsBtn = screen.getByTestId('btn-hazard-details-next');
    fireEvent.click(nextDetailsBtn);

    // Step 3: Submit Report
    const submitBtn = await screen.findByTestId('btn-submit-hazard-report');
    fireEvent.click(submitBtn);

    // Step 4: Verify Online Transmitted Confirmation Copy
    await waitFor(() => {
      expect(screen.getByTestId('report-submitted-title')).toBeTruthy();
    });

    expect(screen.getByTestId('report-submitted-title').textContent).toBe('Report Submitted — Thank You!');
    expect(screen.getByTestId('report-submitted-description').textContent).toContain(
      'Your hazard report helps keep fellow Kenyan commuters safe. Our authority team will review and corroborate it.'
    );
    expect(screen.getByTestId('badge-safety-points-submitted').textContent).toBe('+25 Safety Points');
    expect(screen.getByTestId('badge-trust-score-submitted').textContent).toBe('+10 Trust Score');
    expect(screen.getByTestId('status-report-submitted').textContent).toBe('Status: Pending Verification');

    // Ensure queued copy is NOT rendered
    expect(screen.queryByTestId('report-queued-title')).toBeNull();
    expect(screen.queryByTestId('badge-safety-points-queued')).toBeNull();
    expect(screen.queryByTestId('offline-queue-info-card')).toBeNull();
  });

  it('renders honest offline-queued confirmation with pending sync badges when navigator.onLine === false', async () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    render(
      <MemoryRouter>
        <ReportBlackSpotScreen />
      </MemoryRouter>
    );

    // Step 1: Confirm Location
    const confirmLocBtn = await screen.findByTestId('btn-confirm-location-next');
    fireEvent.click(confirmLocBtn);

    // Step 2: Fill Details
    const titleInput = await screen.findByTestId('input-hazard-title');
    fireEvent.change(titleInput, { target: { value: 'Missing Guardrail on Escarpment' } });
    const nextDetailsBtn = screen.getByTestId('btn-hazard-details-next');
    fireEvent.click(nextDetailsBtn);

    // Step 3: Submit Report
    const submitBtn = await screen.findByTestId('btn-submit-hazard-report');
    fireEvent.click(submitBtn);

    // Assert offline storage & sync count were invoked
    await waitFor(() => {
      expect(offlineStorage.setItem).toHaveBeenCalledWith(
        expect.stringMatching(/^offline_report_bs_/),
        expect.objectContaining({
          title: 'Missing Guardrail on Escarpment',
          status: 'pending',
          retryCount: 0,
        })
      );
      expect(offlineSyncService.updatePendingCount).toHaveBeenCalled();
    });

    // Verify Honest Offline Queued Copy
    await waitFor(() => {
      expect(screen.getByTestId('report-queued-title')).toBeTruthy();
    });

    expect(screen.getByTestId('report-queued-title').textContent).toBe('Report Saved — Will Send Automatically');
    expect(screen.getByTestId('report-queued-description').textContent).toContain(
      "Your hazard report is safely stored on this device. It has not reached Mwendo's servers yet, but will transmit automatically once connectivity returns."
    );
    expect(screen.getByTestId('badge-safety-points-queued').textContent).toBe('+25 Safety Points (Pending Sync)');
    expect(screen.getByTestId('badge-trust-score-queued').textContent).toBe('+10 Trust Score (Pending Sync)');
    expect(screen.getByTestId('status-report-queued').textContent).toContain('Status: Queued Locally (Pending Sync)');
    expect(screen.getByTestId('offline-queue-info-card').textContent).toContain(
      'You can monitor pending sync items in the banner at the top of the screen.'
    );

    // Ensure submitted online claims are NOT rendered
    expect(screen.queryByTestId('report-submitted-title')).toBeNull();
    expect(screen.queryByTestId('badge-safety-points-submitted')).toBeNull();
    expect(screen.queryByText('Report Submitted — Thank You!')).toBeNull();
  });

  it('renders honest offline-queued confirmation when online submission call throws a network error', async () => {
    Object.defineProperty(global.navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });

    vi.mocked(functionsService.reportBlackSpot).mockRejectedValueOnce(
      new Error('Failed to fetch: Network connectivity lost')
    );

    render(
      <MemoryRouter>
        <ReportBlackSpotScreen />
      </MemoryRouter>
    );

    // Step 1: Confirm Location
    const confirmLocBtn = await screen.findByTestId('btn-confirm-location-next');
    fireEvent.click(confirmLocBtn);

    // Step 2: Fill Details
    const titleInput = await screen.findByTestId('input-hazard-title');
    fireEvent.change(titleInput, { target: { value: 'Unmarked Bump on Outer Ring Road' } });
    const nextDetailsBtn = screen.getByTestId('btn-hazard-details-next');
    fireEvent.click(nextDetailsBtn);

    // Step 3: Submit Report
    const submitBtn = await screen.findByTestId('btn-submit-hazard-report');
    fireEvent.click(submitBtn);

    // Assert offline storage saved the failed submission
    await waitFor(() => {
      expect(offlineStorage.setItem).toHaveBeenCalledWith(
        expect.stringMatching(/^offline_report_bs_/),
        expect.objectContaining({
          title: 'Unmarked Bump on Outer Ring Road',
          status: 'pending',
          retryCount: 0,
        })
      );
      expect(offlineSyncService.updatePendingCount).toHaveBeenCalled();
    });

    // Step 4: Verify Honest Offline Queued Confirmation
    await waitFor(() => {
      expect(screen.getByTestId('report-queued-title')).toBeTruthy();
    });

    expect(screen.getByTestId('report-queued-title').textContent).toBe('Report Saved — Will Send Automatically');
    expect(screen.getByTestId('badge-safety-points-queued').textContent).toBe('+25 Safety Points (Pending Sync)');
    expect(screen.getByTestId('badge-trust-score-queued').textContent).toBe('+10 Trust Score (Pending Sync)');
    expect(screen.getByTestId('status-report-queued').textContent).toContain('Status: Queued Locally (Pending Sync)');

    // Ensure submitted online claims are NOT rendered
    expect(screen.queryByTestId('report-submitted-title')).toBeNull();
    expect(screen.queryByTestId('badge-safety-points-submitted')).toBeNull();
    expect(screen.queryByText('Report Submitted — Thank You!')).toBeNull();
  });
});

