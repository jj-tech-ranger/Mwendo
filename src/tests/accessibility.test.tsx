// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import '../services/i18n';
import { PassengerDashboard } from '../features/passenger/PassengerDashboard';
import { PassengerShell } from '../components/shells/PassengerShell';
import { SaccoShell } from '../components/shells/SaccoShell';
import { useAuthStore } from '../store/useAuthStore';

expect.extend(toHaveNoViolations);

describe('Accessibility Audit (axe-core)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'p1',
        uid: 'p1',
        email: 'passenger@test.com',
        displayName: 'John Passenger',
        role: 'passenger',
        isActive: true,
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('PassengerDashboard should have no accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/passenger']}>
        <Routes>
          <Route path="/passenger" element={<PassengerDashboard />} />
        </Routes>
      </MemoryRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('PassengerShell dashboard shell should have no accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/passenger']}>
        <Routes>
          <Route element={<PassengerShell />}>
            <Route path="/passenger" element={<div>Passenger Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('SaccoShell dashboard shell should have no accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/sacco']}>
        <Routes>
          <Route element={<SaccoShell />}>
            <Route path="/sacco" element={<div>SACCO Fleet Overview</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
