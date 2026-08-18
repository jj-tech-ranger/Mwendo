import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  updateProfile,
  User as FirebaseUser,
  EmailAuthProvider,
  linkWithCredential,
  getMultiFactorResolver,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole, UserClaims } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useThemeStore } from '../store/useThemeStore';
import { analyticsService } from './analyticsService';

export interface MfaAuthError extends Error {
  code?: string;
  resolver?: unknown;
}

// SEC-004: Current legal consent policy version ledger
export const CURRENT_PRIVACY_POLICY_VERSION = '1.0.0';

export const authService = {
  // Synchronize Firebase Auth state, ID token custom claims, and Firestore user document
  initAuthListener() {
    if (import.meta.env.DEV && typeof window !== 'undefined' && (window as unknown as { __TEST_AUTH_OVERRIDE__?: boolean }).__TEST_AUTH_OVERRIDE__) {
      useAuthStore.getState().setLoading(false);
      return () => {};
    }
    useAuthStore.getState().setLoading(true);
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (import.meta.env.DEV && typeof window !== 'undefined' && (window as unknown as { __TEST_AUTH_OVERRIDE__?: boolean }).__TEST_AUTH_OVERRIDE__) {
        useAuthStore.getState().setLoading(false);
        return;
      }
      if (!firebaseUser) {
        useAuthStore.getState().setUser(null, null);
        useAuthStore.getState().setLoading(false);
        return;
      }

      try {
        // AUTH-004: Authoritative ID Token Custom Claims retrieval
        const tokenResult = await firebaseUser.getIdTokenResult();
        const claims = (tokenResult?.claims || {}) as UserClaims;

        const profile = await this.fetchOrInitUserProfile(firebaseUser, 'passenger', claims);
        useAuthStore.getState().setUser(profile, claims);
        analyticsService.syncConsentFromProfile(profile);
      } catch (err) {
        console.error('Error loading user profile or token claims:', err);
        // Fallback user object if firestore or token fails temporarily
        const fallbackClaims: UserClaims = { activeRole: 'passenger' };
        useAuthStore.getState().setUser({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Guest Passenger' : 'Commuter'),
          role: 'passenger',
          activeRole: 'passenger',
          claimedActiveRole: 'passenger',
          claims: fallbackClaims,
          isVerified: firebaseUser.emailVerified || false,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isAnonymous: firebaseUser.isAnonymous,
        }, fallbackClaims);
      } finally {
        useAuthStore.getState().setLoading(false);
      }
    });
  },

  async fetchOrInitUserProfile(
    firebaseUser: FirebaseUser,
    defaultRole: UserRole = 'passenger',
    claims?: UserClaims
  ): Promise<UserProfile> {
    // If claims weren't passed in, fetch them from the Firebase Auth user's ID token
    let tokenClaims = claims;
    if (!tokenClaims) {
      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        tokenClaims = (tokenResult?.claims || {}) as UserClaims;
      } catch (e) {
        console.warn('[authService] Could not fetch token claims:', e);
        tokenClaims = {};
      }
    }

    const claimedActiveRole = (tokenClaims?.activeRole as UserRole | undefined) || (firebaseUser.isAnonymous ? 'passenger' : undefined);
    const claimedSaccoId = tokenClaims?.saccoId as string | undefined;
    const claimedAuthorityScope = tokenClaims?.authorityScope as ('national' | 'county') | undefined;
    const claimedIsSuspended = tokenClaims?.isSuspended as boolean | undefined;

    const userRef = doc(db, 'users', firebaseUser.uid);
    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (e) {
      console.warn('[authService] Could not read user document from Firestore (offline or unavailable):', e);
    }

    if (snap && snap.exists()) {
      const data = snap.data();

      // UX-001: Reconcile Firestore language & theme preferences (Firestore wins for signed-in user)
      if (data.language && (data.language === 'en' || data.language === 'sw')) {
        if (useLanguageStore.getState().language !== data.language) {
          useLanguageStore.getState().setLanguage(data.language, false);
        }
      }
      if (data.theme && (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system')) {
        if (useThemeStore.getState().mode !== data.theme) {
          useThemeStore.getState().setMode(data.theme, false);
        }
      }

      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || data.email || '',
        displayName: firebaseUser.displayName || data.displayName || (firebaseUser.isAnonymous ? 'Guest Passenger' : 'Commuter'),
        phoneNumber: firebaseUser.phoneNumber || data.phoneNumber || '',
        role: (data.activeRole || data.role || defaultRole) as UserRole,
        activeRole: (data.activeRole || data.role || defaultRole) as UserRole,
        // AUTH-004: ID Token Custom Claims for Route & Backend Authorization
        claimedActiveRole,
        claimedSaccoId,
        claimedAuthorityScope,
        claimedIsSuspended,
        claims: {
          activeRole: claimedActiveRole,
          saccoId: claimedSaccoId,
          authorityScope: claimedAuthorityScope,
          isSuspended: claimedIsSuspended,
          ...tokenClaims,
        },
        saccoId: data.saccoId,
        authorityId: data.authorityId,
        authorityScope: data.authorityScope,
        county: data.county,
        badgeNumber: data.badgeNumber,
        isVerified: firebaseUser.emailVerified || data.isVerified || false,
        isActive: data.isActive !== false && claimedIsSuspended !== true,
        isMfaEnrolled: Boolean(data.isMfaEnrolled),
        isMfaVerified: Boolean(data.isMfaVerified),
        language: data.language,
        theme: data.theme,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAnonymous: firebaseUser.isAnonymous,
        trustScore: data.trustScore ?? 50,
        // SEC-004: Consent ledger
        termsAccepted: data.termsAccepted,
        privacyPolicyVersion: data.privacyPolicyVersion,
        termsAcceptedAt: data.termsAcceptedAt,
        ageConfirmed: data.ageConfirmed,
        ageConfirmedAt: data.ageConfirmedAt,
      };
    }

    // Initialize brand new user profile in Firestore
    const nowIso = new Date().toISOString();
    const newProfile: UserProfile = {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Guest Passenger' : 'Commuter'),
      role: defaultRole,
      activeRole: defaultRole,
      claimedActiveRole: claimedActiveRole || defaultRole,
      claimedSaccoId,
      claimedAuthorityScope,
      claimedIsSuspended,
      claims: {
        activeRole: claimedActiveRole || defaultRole,
        saccoId: claimedSaccoId,
        authorityScope: claimedAuthorityScope,
        isSuspended: claimedIsSuspended,
        ...tokenClaims,
      },
      isVerified: firebaseUser.emailVerified || false,
      isActive: claimedIsSuspended !== true,
      isMfaEnrolled: false,
      isMfaVerified: false,
      // SEC-002, SEC-003, SEC-004: Explicit Consent Ledger & Age Confirmation
      termsAccepted: true,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      termsAcceptedAt: nowIso,
      ageConfirmed: true,
      ageConfirmedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      isAnonymous: firebaseUser.isAnonymous,
      trustScore: firebaseUser.isAnonymous ? 30 : 50,
    };

    try {
      await setDoc(userRef, {
        ...newProfile,
        activeRole: defaultRole,
        roles: [defaultRole],
      });
    } catch (e) {
      console.warn('[authService] Could not persist new user profile to Firestore (offline mode active):', e);
    }

    return newProfile;
  },

  async signInWithEmail(email: string, pass: string) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      return await this.fetchOrInitUserProfile(cred.user);
    } catch (err: unknown) {
      const errorObj = err as { code?: string; message?: string };
      if (errorObj?.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, err as Parameters<typeof getMultiFactorResolver>[1]);
        const mfaError = new Error('Multi-factor authentication required.') as MfaAuthError;
        mfaError.code = 'auth/multi-factor-auth-required';
        mfaError.resolver = resolver;
        throw mfaError;
      }
      throw err;
    }
  },

  async registerWithEmail(email: string, pass: string, displayName: string, role: UserRole = 'passenger') {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.isAnonymous) {
      // Upgrade anonymous guest account to email/pass preserving UID
      return await this.upgradeGuestAccount(email, pass, displayName, role);
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    return await this.fetchOrInitUserProfile(cred.user, role);
  },

  async upgradeGuestAccount(email: string, pass: string, displayName: string, role: UserRole = 'passenger') {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No user currently signed in');
    }

    const credential = EmailAuthProvider.credential(email, pass);
    let updatedUser: FirebaseUser = currentUser;

    try {
      const result = await linkWithCredential(currentUser, credential);
      updatedUser = result.user;
    } catch (err: unknown) {
      // If link fails (e.g., account already exists), create new account or fallback
      console.warn('Account linking warning, falling back to createUser:', err);
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      updatedUser = cred.user;
    }

    if (displayName) {
      await updateProfile(updatedUser, { displayName });
    }

    const profileRef = doc(db, 'users', updatedUser.uid);
    const nowIso = new Date().toISOString();
    const updatedProfile: UserProfile = {
      id: updatedUser.uid,
      uid: updatedUser.uid,
      email,
      displayName,
      role,
      isVerified: updatedUser.emailVerified,
      isActive: true,
      // SEC-002, SEC-003, SEC-004: Explicit Consent Ledger & Age Confirmation
      termsAccepted: true,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      termsAcceptedAt: nowIso,
      ageConfirmed: true,
      ageConfirmedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      isAnonymous: false,
      trustScore: 60,
    };

    await setDoc(profileRef, {
      ...updatedProfile,
      activeRole: role,
      roles: [role],
    }, { merge: true });

    useAuthStore.getState().setUser(updatedProfile);
    return updatedProfile;
  },

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return await this.fetchOrInitUserProfile(cred.user);
  },

  async signInGuest() {
    try {
      const cred = await signInAnonymously(auth);
      return await this.fetchOrInitUserProfile(cred.user, 'passenger');
    } catch (e) {
      console.warn('Anonymous signin fallback to guest offline profile:', e);
      const fallbackClaims: UserClaims = { activeRole: 'passenger' };
      const nowIso = new Date().toISOString();
      const guestUser: UserProfile = {
        id: `guest_${Date.now()}`,
        uid: `guest_${Date.now()}`,
        email: 'guest@mwendo.co.ke',
        displayName: 'Guest Passenger',
        role: 'passenger',
        activeRole: 'passenger',
        claimedActiveRole: 'passenger',
        claims: fallbackClaims,
        isActive: true,
        isVerified: true,
        isAnonymous: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      useAuthStore.getState().setUser(guestUser, fallbackClaims);
      return guestUser;
    }
  },

  async sendMagicLink(email: string) {
    const actionCodeSettings = {
      url: `${window.location.origin}/auth/verify-email`,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  },

  async completeMagicLinkSignIn(email: string, href: string) {
    if (isSignInWithEmailLink(auth, href)) {
      const cred = await signInWithEmailLink(auth, email, href);
      window.localStorage.removeItem('emailForSignIn');
      return await this.fetchOrInitUserProfile(cred.user);
    }
    return null;
  },

  async sendPasswordReset(email: string) {
    await sendPasswordResetEmail(auth, email);
  },

  async logout() {
    await signOut(auth);
    useAuthStore.getState().logout();
  },

  async updateProfileData(data: Partial<UserProfile>) {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    if (data.displayName) {
      await updateProfile(currentUser, { displayName: data.displayName });
    }

    // Strip out privileged fields so client-side updates match firestore.rules owner update restriction
    const {
      role: _role,
      activeRole: _activeRole,
      roles: _roles,
      saccoId: _saccoId,
      authorityId: _authorityId,
      authorityScope: _authorityScope,
      isActive: _isActive,
      trustScore: _trustScore,
      termsAccepted: _termsAccepted,
      privacyPolicyVersion: _privacyPolicyVersion,
      termsAcceptedAt: _termsAcceptedAt,
      ageConfirmed: _ageConfirmed,
      ageConfirmedAt: _ageConfirmedAt,
      ...safeProfileData
    } = data as Record<string, unknown>;

    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      ...safeProfileData,
      updatedAt: new Date().toISOString(),
    });

    const existingUser = useAuthStore.getState().user;
    if (existingUser) {
      useAuthStore.getState().setUser({
        ...existingUser,
        ...safeProfileData,
      });
    }
  },

  /**
   * Server-Side Role Switching Callable (/v1/setActiveRole)
   * Direct client-side updates to activeRole/role are blocked by security rules.
   * Role updates are processed via server-side verification.
   */
  async setActiveRole(targetRole: UserRole) {
    console.warn(
      `[authService] Client-side write to activeRole ('${targetRole}') is disabled. ` +
      `Role switching requires secure server authorization.`
    );
    throw new Error(
      'Role switching is disabled on the client. Role updates must be performed via secure server authorization.'
    );
  },

  // High-stakes admin live status check (§5.6)
  async checkLiveAdminStatus(uid?: string): Promise<boolean> {
    const targetUid = uid || auth.currentUser?.uid;
    if (!targetUid) return false;

    try {
      const snap = await getDoc(doc(db, 'users', targetUid));
      if (!snap.exists()) return false;
      const data = snap.data();
      return data.isActive !== false && (data.activeRole === 'admin' || data.role === 'admin');
    } catch (err) {
      console.warn('[authService] checkLiveAdminStatus failed:', err);
      return false;
    }
  },
};

