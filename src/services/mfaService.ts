import {
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  MultiFactorResolver,
  MultiFactorSession,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, db, functions } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { UserProfile, UserRole } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import QRCode from 'qrcode';

export interface TotpSetupData {
  secretKey: string;
  qrCodeUrl: string;
  mfaSession?: MultiFactorSession;
  totpSecret?: TotpSecret;
}

export const mfaService = {
  /**
   * Check if MFA is required for a given role per architecture §5.5.
   * Admin and Authority accounts REQUIRE mandatory TOTP MFA.
   * SACCO Manager and Passenger accounts do NOT require MFA.
   */
  isMfaRequiredForRole(role?: UserRole): boolean {
    return role === 'admin' || role === 'authority';
  },

  /**
   * Check if current user has TOTP MFA enrolled in Firebase Auth SDK or Firestore.
   */
  async checkUserMfaEnrolled(user: UserProfile): Promise<boolean> {
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const factors = multiFactor(currentUser).enrolledFactors;
        if (factors && factors.length > 0) {
          return true;
        }
      } catch (err) {
        console.warn('[mfaService] Failed to read multiFactor enrolledFactors:', err);
      }
    }
    return Boolean(user.isMfaEnrolled);
  },

  /**
   * Generate TOTP secret and client-side QR code URL using Firebase Auth SDK.
   * (AUTH-002 / SEC-008): No third-party QR generation APIs and no local unverified secrets.
   */
  async getEnrollmentSecret(user: FirebaseUser): Promise<TotpSetupData> {
    const session = await multiFactor(user).getSession();
    const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
    const accountName = user.email || 'MwendoSalamaUser';
    const otpauthUrl = totpSecret.generateQrCodeUrl(accountName, 'Mwendo Salama Platform');

    // Generate QR code completely client-side to prevent leaking secrets to third-party services
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return {
      secretKey: totpSecret.secretKey,
      qrCodeUrl,
      mfaSession: session,
      totpSecret,
    };
  },

  /**
   * Enroll user in TOTP MFA using Firebase Auth SDK assertion.
   * (AUTH-002): Firestore is ONLY updated after multiFactor(user).enroll() resolves successfully.
   */
  async enrollTotp(user: FirebaseUser, verificationCode: string, setupData: TotpSetupData): Promise<boolean> {
    const cleanCode = verificationCode.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new Error('Verification code must be exactly 6 digits.');
    }

    if (!setupData || !setupData.totpSecret) {
      throw new Error('Invalid TOTP setup session. Please regenerate your MFA setup.');
    }

    // Generate assertion from verified TOTP secret
    const assertion = TotpMultiFactorGenerator.assertionForEnrollment(setupData.totpSecret, cleanCode);

    // Enroll with Firebase Auth - strict propagation on failure (no catch-and-continue)
    await multiFactor(user).enroll(assertion, 'Mwendo Salama Authenticator');

    // Persist MFA enrollment in Firestore user profile ONLY after successful multiFactor enrollment
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      isMfaEnrolled: true,
      isMfaVerified: true,
      totpSecret: setupData.secretKey,
      updatedAt: new Date().toISOString(),
    });

    // Update Zustand auth store
    const currentStoreUser = useAuthStore.getState().user;
    if (currentStoreUser) {
      useAuthStore.getState().setUser({
        ...currentStoreUser,
        isMfaEnrolled: true,
        isMfaVerified: true,
      });
    }

    return true;
  },

  /**
   * Resolve MFA Challenge on login or re-verification (§AUTH-003).
   * - When resolver is present (sign-in flow), resolves via MultiFactorResolver & TotpMultiFactorGenerator.
   * - When resolver is null (RoleGuard re-verification flow), calls callable Cloud Function verifyTotpChallenge
   *   to authoritatively verify against the user's enrolled TOTP secret.
   * - Never allows bypass via regex format validation alone.
   */
  async verifyChallenge(verificationCode: string, resolver?: MultiFactorResolver | null): Promise<boolean> {
    const cleanCode = verificationCode.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new Error('Verification code must be exactly 6 digits.');
    }

    if (resolver) {
      // 1. Sign-in-time MFA challenge with MultiFactorResolver
      const hint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) || resolver.hints[0];
      if (!hint) {
        throw new Error('No valid MFA second factor found on account.');
      }
      try {
        const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, cleanCode);
        await resolver.resolveSignIn(assertion);
      } catch (err: any) {
        console.error('[mfaService] MultiFactorResolver failed:', err);
        if (err.code === 'auth/invalid-verification-code') {
          throw new Error('Invalid 6-digit TOTP verification code.');
        }
        throw err;
      }
    } else {
      // 2. Re-verification / RoleGuard flow without resolver: MUST verify against server-side Cloud Function
      try {
        const verifyCallable = httpsCallable<{ code: string }, { success: boolean; verified: boolean }>(
          functions,
          'verifyTotpChallenge'
        );
        const result = await verifyCallable({ code: cleanCode });
        if (!result?.data?.success && !result?.data?.verified) {
          throw new Error('Invalid 6-digit TOTP verification code.');
        }
      } catch (err: any) {
        console.error('[mfaService] verifyTotpChallenge Cloud Function failed:', err);
        if (
          err.code === 'functions/invalid-argument' ||
          err.code === 'invalid-argument' ||
          err.message?.includes('Invalid') ||
          err.message?.includes('invalid')
        ) {
          throw new Error('Invalid 6-digit TOTP verification code.');
        }
        throw new Error(err.message || 'MFA verification failed. Please check your authenticator code.');
      }
    }

    // Mark current user as MFA verified in local auth store
    const currentStoreUser = useAuthStore.getState().user;
    if (currentStoreUser) {
      useAuthStore.getState().setUser({
        ...currentStoreUser,
        isMfaVerified: true,
      });

      // Also persist isMfaVerified state in Firestore if resolver was used
      if (resolver) {
        try {
          const userRef = doc(db, 'users', currentStoreUser.uid);
          await updateDoc(userRef, {
            isMfaVerified: true,
            updatedAt: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('[mfaService] Failed to write isMfaVerified to Firestore:', e);
        }
      }
    }

    return true;
  },

  /**
   * Unenroll MFA for account
   */
  async unenrollMfa(user: FirebaseUser): Promise<void> {
    const factors = multiFactor(user).enrolledFactors;
    for (const factor of factors) {
      await multiFactor(user).unenroll(factor);
    }

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      isMfaEnrolled: false,
      isMfaVerified: false,
      updatedAt: new Date().toISOString(),
    });

    const currentStoreUser = useAuthStore.getState().user;
    if (currentStoreUser) {
      useAuthStore.getState().setUser({
        ...currentStoreUser,
        isMfaEnrolled: false,
        isMfaVerified: false,
      });
    }
  },
};
