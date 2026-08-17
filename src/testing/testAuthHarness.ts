import { useAuthStore } from '../store/useAuthStore';
import { UserRole, UserClaims } from '../types';

export interface WindowWithAuthHelpers {
  __useAuthStore?: typeof useAuthStore;
  __setTestAuth?: (role?: UserRole, saccoId?: string) => void;
  __TEST_AUTH_OVERRIDE__?: boolean;
  __INITIAL_TEST_ROLE__?: UserRole;
  __INITIAL_TEST_SACCO__?: string;
}

export function installTestAuthHarness(): void {
  if (typeof window === 'undefined') return;

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
