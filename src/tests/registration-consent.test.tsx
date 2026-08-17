// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterScreen } from '../features/auth/RegisterScreen';
import { authService, CURRENT_PRIVACY_POLICY_VERSION } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import * as firestore from 'firebase/firestore';

// Mock firebase/auth
vi.mock('firebase/auth', async (importOriginal) => {
  const original = await importOriginal<Record<string, any>>();
  return {
    ...original,
    createUserWithEmailAndPassword: vi.fn(),
    updateProfile: vi.fn(),
    signInWithPopup: vi.fn(),
    linkWithCredential: vi.fn(),
    EmailAuthProvider: { credential: vi.fn() },
    auth: { currentUser: null },
  };
});

// Mock firebase/firestore
vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof firestore>();
  return {
    ...original,
    doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    getDoc: vi.fn(() => ({ exists: () => false, data: () => ({}) })),
  };
});

describe('SEC-002, SEC-003, SEC-004: Registration Consent Ledger & Age Confirmation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('SEC-002 & SEC-003: initial registration form has unchecked terms and age confirmation checkboxes', () => {
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    );

    const termsCheckbox = screen.getByRole('checkbox', { name: /Terms of Service/i }) as HTMLInputElement;
    const ageCheckbox = screen.getByRole('checkbox', { name: /18 years or older/i }) as HTMLInputElement;

    expect(termsCheckbox.checked).toBe(false);
    expect(ageCheckbox.checked).toBe(false);
  });

  it('SEC-002 & SEC-003: blocks submission with error messages when terms or age are not accepted', async () => {
    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/Full Name/i);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const submitBtn = screen.getByRole('button', { name: /Create Account/i });

    fireEvent.change(nameInput, { target: { value: 'Wanjiku Mwangi' } });
    fireEvent.change(emailInput, { target: { value: 'wanjiku@mwendo.co.ke' } });
    fireEvent.change(passwordInput, { target: { value: 'Pass12345!' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/You must agree to the Terms and Privacy Policy/i)).toBeTruthy();
      expect(screen.getByText(/You must confirm you are 18 years or older/i)).toBeTruthy();
    });
  });

  it('SEC-002 & SEC-003: submits successfully when both checkboxes are affirmatively checked', async () => {
    const registerSpy = vi.spyOn(authService, 'registerWithEmail').mockResolvedValue({} as any);

    render(
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    );

    const nameInput = screen.getByLabelText(/Full Name/i);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/^Password/i);
    const termsCheckbox = screen.getByRole('checkbox', { name: /Terms of Service/i });
    const ageCheckbox = screen.getByRole('checkbox', { name: /18 years or older/i });
    const submitBtn = screen.getByRole('button', { name: /Create Account/i });

    fireEvent.change(nameInput, { target: { value: 'Wanjiku Mwangi' } });
    fireEvent.change(emailInput, { target: { value: 'wanjiku@mwendo.co.ke' } });
    fireEvent.change(passwordInput, { target: { value: 'Pass12345!' } });
    fireEvent.click(termsCheckbox);
    fireEvent.click(ageCheckbox);

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        'wanjiku@mwendo.co.ke',
        'Pass12345!',
        'Wanjiku Mwangi',
        'passenger'
      );
    });
  });

  it('SEC-004: fetchOrInitUserProfile records consent audit metadata upon new account creation', async () => {
    const mockFirebaseUser = {
      uid: 'user_consent_123',
      email: 'consent@mwendo.co.ke',
      displayName: 'Consent User',
      emailVerified: true,
      isAnonymous: false,
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: { activeRole: 'passenger' } }),
    };

    const profile = await authService.fetchOrInitUserProfile(mockFirebaseUser as any);

    expect(profile.termsAccepted).toBe(true);
    expect(profile.privacyPolicyVersion).toBe(CURRENT_PRIVACY_POLICY_VERSION);
    expect(typeof profile.termsAcceptedAt).toBe('string');
    expect(profile.ageConfirmed).toBe(true);
    expect(typeof profile.ageConfirmedAt).toBe('string');

    // Verify setDoc was invoked with consent ledger fields
    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        termsAccepted: true,
        privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        ageConfirmed: true,
      })
    );
  });
});
