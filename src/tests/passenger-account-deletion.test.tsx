// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PassengerProfileScreen } from '../features/passenger/PassengerProfileScreen';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import { UserProfile } from '../types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<Record<string, any>>();
  return {
    ...original,
    useNavigate: () => mockNavigate,
  };
});

const mockUser: UserProfile = {
  id: 'passenger_test_123',
  uid: 'passenger_test_123',
  displayName: 'Grace Commuter',
  email: 'grace@example.com',
  phoneNumber: '+254711223344',
  role: 'passenger',
  activeRole: 'passenger',
  isActive: true,
  isVerified: true,
  trustScore: 92,
  safetyPoints: 150,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PassengerProfileScreen — Account Deletion Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the Delete Account button in settings', () => {
    render(
      <MemoryRouter>
        <PassengerProfileScreen />
      </MemoryRouter>
    );

    const deleteBtn = screen.getByRole('button', { name: /Delete Account/i });
    expect(deleteBtn).toBeDefined();
  });

  it('opens confirmation modal and disables action until DELETE is typed', async () => {
    render(
      <MemoryRouter>
        <PassengerProfileScreen />
      </MemoryRouter>
    );

    // Open modal
    const openModalBtn = screen.getByRole('button', { name: /Delete Account/i });
    fireEvent.click(openModalBtn);

    // Verify modal header & input
    expect(screen.getByText(/Warning: This action cannot be undone/i)).toBeDefined();
    const input = screen.getByPlaceholderText('DELETE');
    expect(input).toBeDefined();

    // Confirm button inside modal should initially be disabled
    const modalConfirmBtns = screen.getAllByRole('button', { name: /Delete Account/i });
    const modalConfirmBtn = modalConfirmBtns[modalConfirmBtns.length - 1] as HTMLButtonElement;
    expect(modalConfirmBtn.disabled).toBe(true);

    // Type partial string
    fireEvent.change(input, { target: { value: 'DEL' } });
    expect(modalConfirmBtn.disabled).toBe(true);

    // Type full confirmation word
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(modalConfirmBtn.disabled).toBe(false);
  });

  it('calls authService.deleteOwnAccount and navigates to login on confirmation', async () => {
    const deleteSpy = vi.spyOn(authService, 'deleteOwnAccount').mockResolvedValue({
      success: true,
      userId: 'passenger_test_123',
      retentionPolicy: 'anonymize-and-retain',
    });

    render(
      <MemoryRouter>
        <PassengerProfileScreen />
      </MemoryRouter>
    );

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /Delete Account/i }));

    // Type DELETE
    const input = screen.getByPlaceholderText('DELETE');
    fireEvent.change(input, { target: { value: 'DELETE' } });

    // Click confirm inside modal
    const modalConfirmBtns = screen.getAllByRole('button', { name: /Delete Account/i });
    const modalConfirmBtn = modalConfirmBtns[modalConfirmBtns.length - 1]!;
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/auth/login');
    });
  });

  it('displays error message if deletion fails and keeps user on page', async () => {
    vi.spyOn(authService, 'deleteOwnAccount').mockRejectedValue(
      new Error('Cloud Function execution failed')
    );

    render(
      <MemoryRouter>
        <PassengerProfileScreen />
      </MemoryRouter>
    );

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /Delete Account/i }));

    // Type DELETE
    const input = screen.getByPlaceholderText('DELETE');
    fireEvent.change(input, { target: { value: 'DELETE' } });

    // Click confirm
    const modalConfirmBtns = screen.getAllByRole('button', { name: /Delete Account/i });
    const modalConfirmBtn = modalConfirmBtns[modalConfirmBtns.length - 1]!;
    fireEvent.click(modalConfirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Cloud Function execution failed')).toBeDefined();
      expect(mockNavigate).not.toHaveBeenCalledWith('/auth/login');
    });
  });
});
