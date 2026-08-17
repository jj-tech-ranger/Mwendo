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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  claims: null,
  isLoading: false,
  isAuthenticated: false,
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
            claimedActiveRole: claims?.activeRole ?? state.user.claimedActiveRole,
            claimedSaccoId: claims?.saccoId ?? state.user.claimedSaccoId,
            claimedAuthorityScope: claims?.authorityScope ?? state.user.claimedAuthorityScope,
            claimedIsSuspended: claims?.isSuspended ?? state.user.claimedIsSuspended,
            claims: claims || undefined,
          }
        : null,
    })),
  setRole: (role) =>
    set((state) => ({
      user: state.user ? { ...state.user, role, activeRole: role } : null,
    })),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, claims: null, isAuthenticated: false, isLoading: false }),
}));
