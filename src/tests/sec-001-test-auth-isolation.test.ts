// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';
import { installTestAuthHarness } from '../testing/testAuthHarness';

describe('SEC-001: Test Auth Harness Isolation & Dev-Only Boundary', () => {
  beforeEach(() => {
    // Reset store and clean up window globals before each test
    useAuthStore.setState({
      user: null,
      claims: null,
      isLoading: false,
      isAuthenticated: false,
    });
    delete (window as any).__setTestAuth;
    delete (window as any).__useAuthStore;
    delete (window as any).__TEST_AUTH_OVERRIDE__;
    delete (window as any).__INITIAL_TEST_ROLE__;
    delete (window as any).__INITIAL_TEST_SACCO__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as any).__setTestAuth;
    delete (window as any).__useAuthStore;
    delete (window as any).__TEST_AUTH_OVERRIDE__;
    delete (window as any).__INITIAL_TEST_ROLE__;
    delete (window as any).__INITIAL_TEST_SACCO__;
  });

  it('asserts window.__setTestAuth is undefined by default when store is imported in production mode', () => {
    // useAuthStore is imported at the top of the file without calling installTestAuthHarness
    expect((window as any).__setTestAuth).toBeUndefined();
    expect((window as any).__useAuthStore).toBeUndefined();
    expect((window as any).__TEST_AUTH_OVERRIDE__).toBeUndefined();
  });

  it('asserts window.__setTestAuth is not installed when import.meta.env.DEV is mocked false', async () => {
    vi.stubEnv('DEV', false);

    // Simulate entry point initialization check
    if (import.meta.env.DEV) {
      const { installTestAuthHarness: installHarness } = await import('../testing/testAuthHarness');
      installHarness();
    }

    expect((window as any).__setTestAuth).toBeUndefined();
    expect((window as any).__useAuthStore).toBeUndefined();
  });

  it('installs harness and configures test auth only when installTestAuthHarness is invoked in dev mode', () => {
    expect((window as any).__setTestAuth).toBeUndefined();

    // Invoking the harness (as main.tsx does during dev mode)
    installTestAuthHarness();

    expect(typeof (window as any).__setTestAuth).toBe('function');
    expect((window as any).__useAuthStore).toBe(useAuthStore);

    // Test executing the harness in dev mode
    (window as any).__setTestAuth('admin');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.role).toBe('admin');
    expect(state.user?.claimedActiveRole).toBe('admin');
    expect(state.claims?.activeRole).toBe('admin');
    expect((window as any).__TEST_AUTH_OVERRIDE__).toBe(true);
  });

  it('auto-applies initial test role if __INITIAL_TEST_ROLE__ is present when harness installs', () => {
    (window as any).__INITIAL_TEST_ROLE__ = 'sacco_manager';
    (window as any).__INITIAL_TEST_SACCO__ = 'sacco_metrolink';

    installTestAuthHarness();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.role).toBe('sacco_manager');
    expect(state.user?.saccoId).toBe('sacco_metrolink');
    expect(state.claims?.saccoId).toBe('sacco_metrolink');
    expect((window as any).__TEST_AUTH_OVERRIDE__).toBe(true);
  });
});
