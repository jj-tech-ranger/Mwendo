// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axeCore from 'axe-core';
import '../services/i18n';
import { PassengerDashboard } from '../features/passenger/PassengerDashboard';
import { PassengerShell } from '../components/shells/PassengerShell';
import { SaccoShell } from '../components/shells/SaccoShell';
import { Input } from '../components/ui/Input';
import { SearchInput } from '../components/ui/SearchInput';
import { useAuthStore } from '../store/useAuthStore';

async function checkA11y(container: Element) {
  const results = await axeCore.run(container);
  expect(results.violations).toEqual([]);
}

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

    await checkA11y(container);
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

    await checkA11y(container);
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

    await checkA11y(container);
  });

  it('Input component with label should automatically associate label and input via useId and have no violations', async () => {
    const { container, getByLabelText } = render(
      <div>
        <form>
          <Input label="Email Address" type="email" placeholder="name@example.com" />
          <Input label="Phone Number" type="tel" helperText="Kenya format: +254..." />
        </form>
      </div>
    );

    const emailInput = getByLabelText('Email Address');
    expect(emailInput).toBeDefined();
    expect(emailInput.getAttribute('id')).toBeTruthy();

    const phoneInput = getByLabelText('Phone Number');
    expect(phoneInput).toBeDefined();
    expect(phoneInput.getAttribute('id')).toBeTruthy();

    await checkA11y(container);
  });

  it('SearchInput component should have accessible label and no violations', async () => {
    const { container, getByLabelText } = render(
      <div>
        <form>
          <SearchInput placeholder="Search SACCOs or vehicles..." />
        </form>
      </div>
    );

    const searchInput = getByLabelText('Search SACCOs or vehicles...');
    expect(searchInput).toBeDefined();

    await checkA11y(container);
  });

  it('Input with error sets aria-invalid, role="alert", and links error id via aria-describedby (A11Y-005)', async () => {
    const { container, getByLabelText, getByRole } = render(
      <div>
        <form>
          <Input
            label="Driver License Number"
            id="driver-license"
            error="License number must be 8 characters long"
          />
        </form>
      </div>
    );

    const input = getByLabelText('Driver License Number');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBe('driver-license-error');

    const alertElement = getByRole('alert');
    expect(alertElement).toBeDefined();
    expect(alertElement.getAttribute('id')).toBe('driver-license-error');
    expect(alertElement.textContent).toBe('License number must be 8 characters long');

    await checkA11y(container);
  });

  it('Input without error sets aria-invalid="false" and does not render alert', () => {
    const { getByLabelText, queryByRole } = render(
      <div>
        <form>
          <Input label="Vehicle Registration" />
        </form>
      </div>
    );

    const input = getByLabelText('Vehicle Registration');
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(queryByRole('alert')).toBeNull();
  });
});
