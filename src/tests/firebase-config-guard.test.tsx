// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { FirebaseConfigGuard } from '../components/common/FirebaseConfigGuard';
import * as firebaseLib from '../lib/firebase';

describe('FirebaseConfigGuard (Truth-in-Reporting)', () => {
  it('renders children when Firebase configuration is valid', () => {
    vi.spyOn(firebaseLib, 'firebaseConfigStatus', 'get').mockReturnValue({
      isValid: true,
      missingKeys: [],
      isTestEnv: true,
      errorMessage: null,
    });

    render(
      <FirebaseConfigGuard>
        <div data-testid="child-content">Main Application Content</div>
      </FirebaseConfigGuard>
    );

    expect(screen.getByTestId('child-content')).toBeTruthy();
    expect(screen.queryByTestId('firebase-config-error-screen')).toBeNull();
  });

  it('renders honest error screen with missing keys and reload button when config is invalid', () => {
    vi.spyOn(firebaseLib, 'firebaseConfigStatus', 'get').mockReturnValue({
      isValid: false,
      missingKeys: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID'],
      isTestEnv: false,
      errorMessage: 'Missing required Firebase environment variable(s)',
    });

    render(
      <FirebaseConfigGuard>
        <div data-testid="child-content">Main Application Content</div>
      </FirebaseConfigGuard>
    );

    expect(screen.queryByTestId('child-content')).toBeNull();
    expect(screen.getByTestId('firebase-config-error-screen')).toBeTruthy();
    expect(screen.getByText('Firebase Configuration Required')).toBeTruthy();
    expect(screen.getByText('VITE_FIREBASE_API_KEY')).toBeTruthy();
    expect(screen.getByText('VITE_FIREBASE_PROJECT_ID')).toBeTruthy();
    expect(screen.getByTestId('btn-reload-config')).toBeTruthy();

    // Acceptance criteria: NO demo mode or simulated data claims
    expect(screen.queryByText(/demo mode/i)).toBeNull();
    expect(screen.queryByText(/simulated local data/i)).toBeNull();
  });
});
