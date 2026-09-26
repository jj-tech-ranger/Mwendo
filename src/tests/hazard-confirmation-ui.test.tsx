// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HazardConfirmationSheet } from '../features/passenger/components/HazardConfirmationSheet';
import { useAuthStore } from '../store/useAuthStore';
import * as firestoreModule from 'firebase/firestore';

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock firestore operations
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof firestoreModule>('firebase/firestore');
  return {
    ...actual,
    doc: vi.fn((_db, ...pathSegments) => ({
      id: pathSegments[pathSegments.length - 1],
      path: pathSegments.join('/'),
    })),
    collection: vi.fn((_db, ...pathSegments) => ({
      path: pathSegments.join('/'),
    })),
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDocs: vi.fn().mockResolvedValue({
      size: 3,
      forEach: (cb: any) => {
        cb({
          id: 'other_user_1',
          data: () => ({ type: 'still_there', timestamp: new Date() }),
        });
        cb({
          id: 'other_user_2',
          data: () => ({ type: 'still_there', timestamp: new Date() }),
        });
        cb({
          id: 'other_user_3',
          data: () => ({ type: 'resolved', timestamp: new Date() }),
        });
      },
    }),
    serverTimestamp: vi.fn(() => 'MOCK_SERVER_TIMESTAMP'),
  };
});

describe('HazardConfirmationSheet (Phase 12 Crowdsourced Confirmation UI)', () => {
  const mockProps = {
    hazardId: 'spot_naivasha_456',
    hazardTitle: 'Severe Pothole Cluster',
    locationName: 'Naivasha - Nakuru Highway',
    severity: 'high' as const,
    description: 'Deep road potholes after rains',
    distanceKm: 2.4,
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides confirmation buttons and shows sign-in notice for unauthenticated/anonymous users', async () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });

    render(<HazardConfirmationSheet {...mockProps} />);

    expect(screen.queryByTestId('confirm-still-there-btn')).toBeNull();
    expect(screen.queryByTestId('confirm-resolved-btn')).toBeNull();
    expect(screen.getByText(/Sign In Required to Corroborate/i)).toBeTruthy();
  });

  it('renders "Still there" and "Resolved" buttons for registered users', async () => {
    useAuthStore.setState({
      user: {
        uid: 'registered_passenger_1',
        id: 'registered_passenger_1',
        role: 'passenger',
        activeRole: 'passenger',
      } as any,
      isAuthenticated: true,
    });

    render(<HazardConfirmationSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('confirm-still-there-btn')).toBeTruthy();
      expect(screen.getByTestId('confirm-resolved-btn')).toBeTruthy();
    });

    expect(screen.getByText('Still there')).toBeTruthy();
    expect(screen.getByText('Resolved')).toBeTruthy();
  });

  it('displays aggregate state correctly (still there and resolved counts)', async () => {
    useAuthStore.setState({
      user: {
        uid: 'registered_passenger_1',
        id: 'registered_passenger_1',
        role: 'passenger',
        activeRole: 'passenger',
      } as any,
      isAuthenticated: true,
    });

    render(<HazardConfirmationSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('aggregate-still-there-count').textContent).toContain('2 confirmed still there');
      expect(screen.getByTestId('aggregate-resolved-count').textContent).toContain('1 resolved');
    });
  });

  it('submits "still_there" write directly to black_spots/{spotId}/confirmations/{uid}', async () => {
    const userId = 'commuter_jane_doe';
    useAuthStore.setState({
      user: {
        uid: userId,
        id: userId,
        role: 'passenger',
        activeRole: 'passenger',
      } as any,
      isAuthenticated: true,
    });

    render(<HazardConfirmationSheet {...mockProps} />);

    const stillThereBtn = await screen.findByTestId('confirm-still-there-btn');
    fireEvent.click(stillThereBtn);

    await waitFor(() => {
      expect(firestoreModule.doc).toHaveBeenCalledWith(
        expect.anything(),
        'black_spots',
        'spot_naivasha_456',
        'confirmations',
        userId
      );
      expect(firestoreModule.setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `black_spots/spot_naivasha_456/confirmations/${userId}` }),
        expect.objectContaining({
          userId,
          type: 'still_there',
          timestamp: 'MOCK_SERVER_TIMESTAMP',
        })
      );
    });
  });

  it('submits "resolved" write directly to black_spots/{spotId}/confirmations/{uid}', async () => {
    const userId = 'commuter_john_doe';
    useAuthStore.setState({
      user: {
        uid: userId,
        id: userId,
        role: 'passenger',
        activeRole: 'passenger',
      } as any,
      isAuthenticated: true,
    });

    render(<HazardConfirmationSheet {...mockProps} />);

    const resolvedBtn = await screen.findByTestId('confirm-resolved-btn');
    fireEvent.click(resolvedBtn);

    await waitFor(() => {
      expect(firestoreModule.doc).toHaveBeenCalledWith(
        expect.anything(),
        'black_spots',
        'spot_naivasha_456',
        'confirmations',
        userId
      );
      expect(firestoreModule.setDoc).toHaveBeenCalledWith(
        expect.objectContaining({ path: `black_spots/spot_naivasha_456/confirmations/${userId}` }),
        expect.objectContaining({
          userId,
          type: 'resolved',
          timestamp: 'MOCK_SERVER_TIMESTAMP',
        })
      );
    });
  });

  it('disables buttons and displays 24-hour cooldown badge when user has confirmed within 24 hours', async () => {
    const userId = 'user_with_active_cooldown';
    // Mock getDocs returning a recent confirmation by this user (1 hour ago)
    vi.mocked(firestoreModule.getDocs).mockResolvedValueOnce({
      size: 1,
      forEach: (cb: any) => {
        cb({
          id: userId,
          data: () => ({
            type: 'still_there',
            timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          }),
        });
      },
    } as any);

    useAuthStore.setState({
      user: {
        uid: userId,
        id: userId,
        role: 'passenger',
        activeRole: 'passenger',
      } as any,
      isAuthenticated: true,
    });

    render(<HazardConfirmationSheet {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('confirmation-cooldown-badge')).toBeTruthy();
      expect(screen.getByTestId('confirm-still-there-btn')).toHaveProperty('disabled', true);
      expect(screen.getByTestId('confirm-resolved-btn')).toHaveProperty('disabled', true);
    });
  });
});
