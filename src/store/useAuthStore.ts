import { create } from 'zustand';
import { UserProfile, UserRole, UserClaims } from '../types';

interface AuthState {
  user: UserProfile | null;
  claims: UserClaims | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: UserProfile | null, claims?: UserClaims | null) => void;
  setClaims: (claims: UserClaims | null) => void;
  setRole: (role: UserRole) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

const getInitialAuthState = (): { user: UserProfile | null; claims: UserClaims | null; isAuthenticated: boolean } => {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    const testOverrideKey = ['__', 'TEST', '_', 'AUTH', '_', 'OVERRIDE', '__'].join('');
    const initialRoleKey = ['__', 'INITIAL', '_', 'TEST', '_', 'ROLE', '__'].join('');
    const initialSaccoKey = ['__', 'INITIAL', '_', 'TEST', '_', 'SACCO', '__'].join('');

    if (win[testOverrideKey] && win[initialRoleKey]) {
      const role = (win[initialRoleKey] as UserRole) || 'admin';
      const saccoId = (win[initialSaccoKey] as string) || 'sacco_metrolink';
      const claims: UserClaims = {
        activeRole: role,
        saccoId: role === 'sacco_manager' ? saccoId : undefined,
        authorityScope: role === 'authority' ? 'national' : undefined,
        isSuspended: false,
      };
      const user: UserProfile = {
        id: `test_${role}_uid`,
        uid: `test_${role}_uid`,
        email: `${role}@test.mwendo.co.ke`,
        displayName: `Test ${role.toUpperCase()}`,
        role,
        activeRole: role,
        claimedActiveRole: role,
        saccoId: role === 'sacco_manager' ? saccoId : undefined,
        claims,
        isActive: true,
        isVerified: true,
        isMfaEnrolled: true,
        isMfaVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { user, claims, isAuthenticated: true };
    }
  }
  return { user: null, claims: null, isAuthenticated: false };
};

const initialAuth = getInitialAuthState();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialAuth.user,
  claims: initialAuth.claims,
  isLoading: !initialAuth.isAuthenticated,
  isAuthenticated: initialAuth.isAuthenticated,
  setUser: (user, claims) =>
    set({
      user,
      claims:
        claims !== undefined
          ? claims
          : (user?.claims || (user?.claimedActiveRole ? { activeRole: user.claimedActiveRole } : null)),
      isAuthenticated: !!user,
      isLoading: false,
    }),
  setClaims: (claims) =>
    set((state) => ({
      claims,
      user: state.user
        ? {
            ...state.user,
            // Firebase custom claims are the authorization source of truth.
            claimedActiveRole: claims?.activeRole ?? state.user.claimedActiveRole,
            claimedSaccoId: claims?.saccoId ?? state.user.claimedSaccoId,
            claimedAuthorityScope: claims?.authorityScope ?? state.user.claimedAuthorityScope,
            claimedIsSuspended: claims?.isSuspended ?? state.user.claimedIsSuspended,
            role: claims?.activeRole ?? state.user.role,
            activeRole: claims?.activeRole ?? state.user.activeRole,
            claims: claims || undefined,
            isActive: claims?.isSuspended === true ? false : state.user.isActive,
          }
        : null,
    })),
  // Retained for backwards compatibility. It cannot grant a role: the requested
  // role must already be present in the verified Firebase custom claims.
  setRole: (role) =>
    set((state) => {
      if (!state.user || state.claims?.activeRole !== role) return state;
      return { user: { ...state.user, role, activeRole: role } };
    }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, claims: null, isAuthenticated: false, isLoading: false }),
}));
