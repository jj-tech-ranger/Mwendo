import { describe, expect, it, beforeEach } from 'vitest';
import { useAuthStore } from '../store/useAuthStore';
import type { UserProfile } from '../types';

const passenger: UserProfile = {
  id: 'user-1',
  uid: 'user-1',
  email: 'user@example.com',
  displayName: 'Passenger',
  role: 'passenger',
  activeRole: 'passenger',
  claimedActiveRole: 'passenger',
  claims: { activeRole: 'passenger' },
  isActive: true,
  isVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('auth store authorization boundary', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: passenger,
      claims: { activeRole: 'passenger' },
      isLoading: false,
      isAuthenticated: true,
    });
  });

  it('does not allow setRole to elevate a passenger without a matching claim', () => {
    useAuthStore.getState().setRole('admin');

    const state = useAuthStore.getState();
    expect(state.user?.role).toBe('passenger');
    expect(state.user?.activeRole).toBe('passenger');
    expect(state.claims?.activeRole).toBe('passenger');
  });

  it('allows setRole only for the role already present in verified claims', () => {
    useAuthStore.getState().setRole('passenger');
    expect(useAuthStore.getState().user?.activeRole).toBe('passenger');
  });

  it('synchronizes local role and active state when verified claims change', () => {
    useAuthStore.getState().setClaims({ activeRole: 'sacco_manager', saccoId: 'sacco-a' });

    const state = useAuthStore.getState();
    expect(state.user?.role).toBe('sacco_manager');
    expect(state.user?.activeRole).toBe('sacco_manager');
    expect(state.user?.claimedActiveRole).toBe('sacco_manager');
    expect(state.user?.claimedSaccoId).toBe('sacco-a');
  });

  it('marks the local account inactive when the verified claim suspends it', () => {
    useAuthStore.getState().setClaims({ activeRole: 'passenger', isSuspended: true });

    expect(useAuthStore.getState().user?.isActive).toBe(false);
    expect(useAuthStore.getState().user?.claimedIsSuspended).toBe(true);
  });

  it('clears stale authorization claims when Firebase returns no claims', () => {
    useAuthStore.getState().setClaims(null);

    const state = useAuthStore.getState();
    expect(state.claims).toBeNull();
    // Display/profile role may remain for UI continuity, but authorization claims must clear.
    expect(state.user?.claimedActiveRole).toBeUndefined();
    expect(state.user?.claimedSaccoId).toBeUndefined();
    expect(state.user?.claimedAuthorityScope).toBeUndefined();
    expect(state.user?.claimedIsSuspended).toBeUndefined();
    expect(state.user?.role).toBe('passenger');
    expect(state.user?.activeRole).toBeUndefined();
  });
});
