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

interface WindowWithAuthHelpers {
  __useAuthStore?: typeof useAuthStore;
  __setTestAuth?: (role?: UserRole, saccoId?: string) => void;
  __TEST_AUTH_OVERRIDE__?: boolean;
  __INITIAL_TEST_ROLE__?: UserRole;
  __INITIAL_TEST_SACCO__?: string;
}

if (typeof window !== 'undefined') {
  const win = window as unknown as WindowWithAuthHelpers;
  win.__useAuthStore = useAuthStore;
  win.__setTestAuth = (
    role: UserRole = 'admin',
    saccoId = 'sacco_metrolink'
  ) => {
    win.__TEST_AUTH_OVERRIDE__ = true;
    const claims: UserClaims = {
      activeRole: role,
      saccoId: role === 'sacco_manager' ? saccoId : undefined,
      authorityScope: role === 'authority' ? 'national' : undefined,
      isSuspended: false,
    };
    useAuthStore.getState().setUser(
      {
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
      },
      claims
    );
  };

  if (win.__INITIAL_TEST_ROLE__) {
    win.__setTestAuth(
      win.__INITIAL_TEST_ROLE__,
      win.__INITIAL_TEST_SACCO__ || 'sacco_metrolink'
    );
  }
}
