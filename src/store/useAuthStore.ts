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

export const AUTH_SESSION_STORAGE_KEY = 'mwendosalama_auth_session_cache';

const getInitialAuthState = (): { user: UserProfile | null; claims: UserClaims | null; isAuthenticated: boolean } => {
  if (typeof window !== 'undefined') {
    const cached = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.user) {
          return { user: parsed.user, claims: parsed.claims, isAuthenticated: true };
        }
      } catch {}
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
  setUser: (user, claims) => {
    const resolvedClaims =
      claims !== undefined
        ? claims
        : (user?.claims || (user?.claimedActiveRole ? { activeRole: user.claimedActiveRole } : null));

    if (typeof window !== 'undefined') {
      try {
        if (user) {
          window.localStorage.setItem(
            AUTH_SESSION_STORAGE_KEY,
            JSON.stringify({ user, claims: resolvedClaims })
          );
        } else {
          window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        }
      } catch {}
    }

    set({
      user,
      claims: resolvedClaims,
      isAuthenticated: !!user,
      isLoading: false,
    });
  },
  setClaims: (claims) =>
    set((state) => {
      if (!state.user) return { claims, user: null };

      // Firebase custom claims are the authorization source of truth. A missing
      // activeRole must clear the local authorization role rather than retaining
      // a stale role from an earlier token. UserProfile.role remains the required
      // baseline profile role and is only replaced when a verified claim exists.
      const activeRole = claims?.activeRole;
      const nextUser: UserProfile = {
        ...state.user,
        claimedActiveRole: activeRole,
        claimedSaccoId: claims?.saccoId,
        claimedAuthorityScope: claims?.authorityScope,
        claimedIsSuspended: claims?.isSuspended,
        // Keep the persisted profile role as the non-authorizing baseline. Claims
        // may clear activeRole, but that must never make the required role field
        // undefined or accidentally re-authorize the previous active role.
        role: activeRole ?? state.user.role ?? 'passenger',
        activeRole: activeRole,
        claims: claims || undefined,
        isActive: claims?.isSuspended === true ? false : state.user.isActive,
      };

      return { claims, user: nextUser };
    }),
  // Retained for backwards compatibility. It cannot grant a role: the requested
  // role must already be present in the verified Firebase custom claims.
  setRole: (role) =>
    set((state) => {
      if (!state.user || state.claims?.activeRole !== role) return state;
      return { user: { ...state.user, role, activeRole: role } };
    }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      } catch {}
    }
    set({ user: null, claims: null, isAuthenticated: false, isLoading: false });
  },
}));
