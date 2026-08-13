// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleGuard } from '../components/common/RoleGuard';
import { useAuthStore } from '../store/useAuthStore';
import { authService } from '../services/authService';
import * as firestore from 'firebase/firestore';

vi.mock('firebase/firestore', async (importOriginal) => {
  const original = await importOriginal<typeof firestore>();
  return {
    ...original,
    doc: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
  };
});

describe('RoleGuard - Route Level Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      claims: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('confirming unauthenticated access to a protected route redirects to /auth/login (regression test for issue #5)', async () => {
    render(
      <MemoryRouter initialEntries={['/passenger/dashboard']}>
        <Routes>
          <Route path="/auth/login" element={<div>Login Page</div>} />
          <Route element={<RoleGuard allowedRoles={['passenger']} />}>
            <Route path="/passenger/dashboard" element={<div>Passenger Protected Route</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeTruthy();
    expect(screen.queryByText('Passenger Protected Route')).toBeNull();
  });

  it('redirects suspended user to /auth/suspended', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        uid: 'u1',
        email: 'user@test.com',
        displayName: 'Test User',
        role: 'admin',
        isActive: false,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/auth/suspended" element={<div>Account Suspended</div>} />
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin" element={<div>Admin Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Account Suspended')).toBeTruthy();
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
  });

  it('redirects unauthorized role to /auth/unauthorized', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        uid: 'u1',
        email: 'passenger@test.com',
        displayName: 'Passenger',
        role: 'passenger',
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/auth/unauthorized" element={<div>Unauthorized Access</div>} />
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin" element={<div>Admin Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Unauthorized Access')).toBeTruthy();
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
  });

  it('allows authorized admin access to /admin', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        uid: 'u1',
        email: 'admin@test.com',
        displayName: 'Admin User',
        role: 'admin',
        claimedActiveRole: 'admin',
        isMfaEnrolled: true,
        isMfaVerified: true,
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin" element={<div>Admin Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Dashboard')).toBeTruthy();
  });

  it('AUTH-004: strictly denies admin route access when Firestore document has activeRole: admin but ID token custom claim is passenger', async () => {
    // Scenario: An attacker or desynchronized user modified their Firestore document to say 'admin',
    // but their Firebase Auth ID token custom claim is only 'passenger'.
    useAuthStore.setState({
      user: {
        id: 'u1',
        uid: 'u1',
        email: 'attacker@test.com',
        displayName: 'Untrusted User',
        role: 'admin', // Document-derived field says admin
        activeRole: 'admin', // Document-derived field says admin
        claimedActiveRole: 'passenger', // Authoritative ID token custom claim is passenger
        claims: { activeRole: 'passenger' },
        isMfaEnrolled: true,
        isMfaVerified: true,
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      claims: { activeRole: 'passenger' },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/auth/unauthorized" element={<div>Unauthorized Access</div>} />
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin" element={<div>Admin Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // RoleGuard MUST evaluate the ID token claim ('passenger') and reject access to /admin
    expect(screen.getByText('Unauthorized Access')).toBeTruthy();
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
  });

  it('AUTH-004 end-to-end: mocked Firebase Auth user whose getIdTokenResult() returns activeRole: passenger while Firestore doc says activeRole: admin denies admin access in RoleGuard', async () => {
    // 1. Mock Firebase Auth user with getIdTokenResult returning activeRole: 'passenger'
    const mockFirebaseUser = {
      uid: 'user_exploit_123',
      email: 'attacker@mwendo.co.ke',
      displayName: 'Attacker Attempting Escalation',
      emailVerified: true,
      isAnonymous: false,
      getIdTokenResult: vi.fn().mockResolvedValue({
        claims: {
          activeRole: 'passenger', // Authoritative token claim
          isSuspended: false,
        },
      }),
    } as any;

    // 2. Mock Firestore returning document claiming activeRole: 'admin'
    (firestore.getDoc as any).mockResolvedValue({
      exists: () => true,
      data: () => ({
        email: 'attacker@mwendo.co.ke',
        displayName: 'Attacker Attempting Escalation',
        role: 'admin',
        activeRole: 'admin', // Compromised/tampered Firestore document field
        isActive: true,
        isMfaEnrolled: true,
        isMfaVerified: true,
        createdAt: '2026-01-01',
      }),
    });

    // 3. Process auth state initialization through authService
    const tokenResult = await mockFirebaseUser.getIdTokenResult();
    const profile = await authService.fetchOrInitUserProfile(
      mockFirebaseUser,
      'passenger',
      tokenResult.claims
    );
    useAuthStore.getState().setUser(profile, tokenResult.claims);

    // Verify profile structure reflects the separate sources
    expect(useAuthStore.getState().user?.role).toBe('admin'); // Firestore display role
    expect(useAuthStore.getState().user?.activeRole).toBe('admin'); // Firestore display role
    expect(useAuthStore.getState().user?.claimedActiveRole).toBe('passenger'); // Authoritative claim
    expect(useAuthStore.getState().claims?.activeRole).toBe('passenger');

    // 4. Render RoleGuard on /admin route
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/auth/unauthorized" element={<div>Unauthorized Access</div>} />
          <Route element={<RoleGuard allowedRoles={['admin']} />}>
            <Route path="/admin" element={<div>Admin Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Assert RoleGuard denies access to the admin route because ID token claim governs authorization
    expect(screen.getByText('Unauthorized Access')).toBeTruthy();
    expect(screen.queryByText('Admin Dashboard')).toBeNull();
  });
});
