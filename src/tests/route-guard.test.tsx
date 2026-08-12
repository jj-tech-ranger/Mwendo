// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RoleGuard } from '../components/common/RoleGuard';
import { useAuthStore } from '../store/useAuthStore';

describe('RoleGuard - Route Level Security', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
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
});
