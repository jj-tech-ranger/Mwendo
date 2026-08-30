// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterScreen } from '../features/auth/RegisterScreen';
import { authService, CURRENT_PRIVACY_POLICY_VERSION } from '../services/authService';
import { useAuthStore } from '../store/useAuthStore';
import * as firestore from 'firebase/firestore';

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
    render(<MemoryRouter><RegisterScreen /></MemoryRouter>);
    const termsCheckbox = screen.getByRole('checkbox', { name: /Terms of Service/i }) as HTMLInputElement;
    const ageCheckbox = screen.getByRole('checkbox', { name: /18 years or older/i }) as HTMLInputElement;
    expect(termsCheckbox.checked).toBe(false);
    expect(ageCheckbox.checked).toBe(false);
  });

  it('SEC-002 & SEC-003: blocks submission with error messages when terms or age are not accepted', async () => {
    render(<MemoryRouter><RegisterScreen /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Wanjiku Mwangi' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'wanjiku@mwendo.co.ke' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Pass12345!' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));
    await waitFor(() => {
      expect(screen.getByText(/You must agree to the Terms and Privacy Policy/i)).toBeTruthy();
      expect(screen.getByText(/You must confirm you are 18 years or older/i)).toBeTruthy();
    });
  });

  it('SEC-002 & SEC-003: passes affirmative consent to the auth service', async () => {
    const registerSpy = vi.spyOn(authService, 'registerWithEmail').mockResolvedValue({} as any);
    render(<MemoryRouter><RegisterScreen /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Wanjiku Mwangi' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'wanjiku@mwendo.co.ke' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'Pass12345!' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Terms of Service/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /18 years or older/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith(
        'wanjiku@mwendo.co.ke',
        'Pass12345!',
        'Wanjiku Mwangi',
        'passenger',
        { termsAccepted: true, ageConfirmed: true }
      );
    });
  });

  it('SEC-004: fetchOrInitUserProfile records only supplied consent for new account creation', async () => {
    const mockFirebaseUser = {
      uid: 'user_consent_123',
      email: 'consent@mwendo.co.ke',
      displayName: 'Consent User',
      emailVerified: true,
      isAnonymous: false,
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: { activeRole: 'passenger' } }),
    };

    const profile = await authService.fetchOrInitUserProfile(mockFirebaseUser as any, 'passenger', undefined, {
      termsAccepted: true,
      ageConfirmed: true,
    });

    expect(profile.termsAccepted).toBe(true);
    expect(profile.privacyPolicyVersion).toBe(CURRENT_PRIVACY_POLICY_VERSION);
    expect(typeof profile.termsAcceptedAt).toBe('string');
    expect(profile.ageConfirmed).toBe(true);
    expect(typeof profile.ageConfirmedAt).toBe('string');
    expect(firestore.setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ termsAccepted: true, privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION, ageConfirmed: true })
    );
  });
});
