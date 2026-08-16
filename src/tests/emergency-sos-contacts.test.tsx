// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
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
});
