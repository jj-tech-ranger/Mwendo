// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateAvailableScreen } from '../features/common/UpdateAvailableScreen';
import { usePwaStore } from '../store/usePwaStore';

describe('Root & Shell Safety (UpdateAvailableScreen & Error Prevention)', () => {
  it('renders UpdateAvailableScreen standalone outside of <Router> without throwing useNavigate error', () => {
    // Render without any MemoryRouter or BrowserRouter
    const onDismiss = vi.fn();
    render(<UpdateAvailableScreen onDismiss={onDismiss} />);

    expect(screen.getByText(/A safer ride is ready/i)).toBeDefined();
    expect(screen.getByText(/Update Now/i)).toBeDefined();
    expect(screen.getByText(/Later/i)).toBeDefined();

    // Clicking Later dismisses safely
    fireEvent.click(screen.getByText(/Later/i));
    expect(onDismiss).toHaveBeenCalled();
    expect(usePwaStore.getState().isUpdateAvailable).toBe(false);
  });
});
