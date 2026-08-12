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
import { UserProfile, UserRole } from '../types';
import { useAuthStore } from '../store/useAuthStore';

export const authService = {
  // Synchronize Firebase Auth state with Firestore user document
  initAuthListener() {
    useAuthStore.getState().setLoading(true);
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        useAuthStore.getState().setUser(null);
        useAuthStore.getState().setLoading(false);
        return;
      }

      try {
        const profile = await this.fetchOrInitUserProfile(firebaseUser);
        useAuthStore.getState().setUser(profile);
      } catch (err) {
        console.error('Error loading user profile:', err);
        // Fallback user object if firestore fails temporarily
        useAuthStore.getState().setUser({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Guest Passenger' : 'Commuter'),
          role: 'passenger',
          isVerified: firebaseUser.emailVerified || false,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isAnonymous: firebaseUser.isAnonymous,
        });
      } finally {
        useAuthStore.getState().setLoading(false);
      }
    });
  },

  async fetchOrInitUserProfile(firebaseUser: FirebaseUser, defaultRole: UserRole = 'passenger'): Promise<UserProfile> {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email || data.email || '',
        displayName: firebaseUser.displayName || data.displayName || (firebaseUser.isAnonymous ? 'Guest Passenger' : 'Commuter'),
        phoneNumber: firebaseUser.phoneNumber || data.phoneNumber || '',
        role: (data.activeRole || data.role || defaultRole) as UserRole,
        saccoId: data.saccoId,
        authorityId: data.authorityId,
        isVerified: firebaseUser.emailVerified || data.isVerified || false,
        isActive: data.isActive !== false,
        isMfaEnrolled: Boolean(data.isMfaEnrolled),
        isMfaVerified: Boolean(data.isMfaVerified),
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isAnonymous: firebaseUser.isAnonymous,
        trustScore: data.trustScore ?? 50,
      };
    }

    // Initialize brand new user profile in Firestore
    const newProfile: UserProfile = {
      id: firebaseUser.uid,
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Guest Passenger' : 'Commuter'),
      role: defaultRole,
      isVerified: firebaseUser.emailVerified || false,
      isActive: true,
      isMfaEnrolled: false,
      isMfaVerified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isAnonymous: firebaseUser.isAnonymous,
      trustScore: firebaseUser.isAnonymous ? 30 : 50,
    };

    await setDoc(userRef, {
      ...newProfile,
      activeRole: defaultRole,
      roles: [defaultRole],
    });

    return newProfile;
  },

  async signInWithEmail(email: string, pass: string) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      return await this.fetchOrInitUserProfile(cred.user);
    } catch (err: any) {
      if (err.code === 'auth/multi-factor-auth-required') {
        const resolver = getMultiFactorResolver(auth, err);
        const mfaError = new Error('Multi-factor authentication required.');
        (mfaError as any).code = 'auth/multi-factor-auth-required';
        (mfaError as any).resolver = resolver;
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
    } catch (err: any) {
      // If link fails (e.g., account already exists), create new account or fallback
      console.warn('Account linking warning, falling back to createUser:', err);
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      updatedUser = cred.user;
    }

    if (displayName) {
      await updateProfile(updatedUser, { displayName });
    }

    const profileRef = doc(db, 'users', updatedUser.uid);
    const updatedProfile: UserProfile = {
      id: updatedUser.uid,
      uid: updatedUser.uid,
      email,
      displayName,
      role,
      isVerified: updatedUser.emailVerified,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
    const cred = await signInAnonymously(auth);
    return await this.fetchOrInitUserProfile(cred.user, 'passenger');
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
      role,
      activeRole,
      roles,
      saccoId,
      authorityId,
      authorityScope,
      isActive,
      trustScore,
      ...safeProfileData
    } = data as any;

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
   * TODO: Server-Side Role Switching Callable (/v1/setActiveRole)
   * Direct client-side updates to activeRole/role in Firestore are strictly blocked by firestore.rules.
   * Role switching MUST be processed by a backend Cloud Function callable (e.g. httpsCallable(functions, 'setActiveRole')).
   * The Cloud Function will:
   * 1. Validate targetRole against user's assigned roles[] in Firestore.
   * 2. Set custom user claims via Firebase Admin SDK (admin.auth().setCustomUserClaims(uid, { activeRole: targetRole })).
   * 3. Update activeRole in user's Firestore document.
   * 4. Instruct client to force refresh token context (`getIdToken(true)`).
   */
  async setActiveRole(targetRole: UserRole) {
    console.warn(
      `[authService] Client-side write to activeRole ('${targetRole}') is disabled. ` +
      `Role switching requires the backend Cloud Function callable (/v1/setActiveRole).`
    );
    throw new Error(
      'Role switching is disabled on the client. Role updates must be performed via a secure server-side Cloud Function.'
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

