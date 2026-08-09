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
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return await this.fetchOrInitUserProfile(cred.user);
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

    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    const existingUser = useAuthStore.getState().user;
    if (existingUser) {
      useAuthStore.getState().setUser({
        ...existingUser,
        ...data,
      });
    }
  },

  // /v1/setActiveRole implementation (§5.2)
  async setActiveRole(targetRole: UserRole) {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Unauthenticated user cannot change active role');
    }

    // Verify live state in Firestore
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      throw new Error('User profile not found');
    }

    const userData = snap.data();
    if (userData.isActive === false) {
      throw new Error('Account suspended');
    }

    const allowedRoles: UserRole[] = userData.roles || [userData.role || 'passenger'];
    if (!allowedRoles.includes(targetRole) && targetRole !== 'passenger') {
      throw new Error(`Role ${targetRole} is not in user's assigned roles`);
    }

    // Update activeRole in Firestore document
    await updateDoc(userRef, {
      activeRole: targetRole,
      role: targetRole,
      updatedAt: new Date().toISOString(),
    });

    // Force ID token refresh to update token context
    await currentUser.getIdToken(true);

    const existingUser = useAuthStore.getState().user;
    if (existingUser) {
      useAuthStore.getState().setUser({
        ...existingUser,
        role: targetRole,
        activeRole: targetRole,
      });
    }
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

