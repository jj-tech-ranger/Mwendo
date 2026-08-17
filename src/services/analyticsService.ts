import { setAnalyticsCollectionEnabled, logEvent } from 'firebase/analytics';
import { doc, updateDoc } from 'firebase/firestore';
import { getAnalyticsInstance, db, auth } from '../lib/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { UserProfile } from '../types';

const DPA_CONSENT_KEY = 'mwendosalama_kenya_dpa_2019_consent';
const DPA_CONSENT_AT_KEY = 'mwendosalama_kenya_dpa_2019_consent_at';

export const analyticsService = {
  /**
   * Returns true if user has explicitly recorded a consent choice (either granted or denied)
   */
  hasConsentChoice(): boolean {
    const localVal = typeof window !== 'undefined' ? window.localStorage.getItem(DPA_CONSENT_KEY) : null;
    if (localVal === 'granted' || localVal === 'denied') return true;

    const user = useAuthStore.getState().user;
    return user?.analyticsConsent !== undefined;
  },

  /**
   * Check if user has granted explicit consent under Kenya Data Protection Act (DPA) 2019
   */
  hasDpaConsent(): boolean {
    if (typeof window !== 'undefined') {
      const localVal = window.localStorage.getItem(DPA_CONSENT_KEY);
      if (localVal === 'granted') return true;
      if (localVal === 'denied') return false;
    }

    const user = useAuthStore.getState().user;
    return user?.analyticsConsent === true;
  },

  /**
   * Get current consent state: true (granted), false (denied), or null (not decided yet)
   */
  getDpaConsent(): boolean | null {
    if (typeof window !== 'undefined') {
      const localVal = window.localStorage.getItem(DPA_CONSENT_KEY);
      if (localVal === 'granted') return true;
      if (localVal === 'denied') return false;
    }

    const user = useAuthStore.getState().user;
    if (user?.analyticsConsent !== undefined) {
      return user.analyticsConsent;
    }

    return null;
  },

  /**
   * Set explicit DPA 2019 consent state, persists to localStorage and Firestore user profile
   */
  async setDpaConsent(granted: boolean, explicitUserId?: string): Promise<void> {
    const timestamp = new Date().toISOString();

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DPA_CONSENT_KEY, granted ? 'granted' : 'denied');
      window.localStorage.setItem(DPA_CONSENT_AT_KEY, timestamp);
    }

    const analytics = getAnalyticsInstance();
    if (analytics) {
      setAnalyticsCollectionEnabled(analytics, granted);
      console.log(`[Analytics] Kenya DPA 2019 consent set to: ${granted}`);
    }

    const targetUid = explicitUserId || auth.currentUser?.uid || useAuthStore.getState().user?.uid || useAuthStore.getState().user?.id;

    if (targetUid && targetUid !== 'anonymous') {
      try {
        const userRef = doc(db, 'users', targetUid);
        await updateDoc(userRef, {
          analyticsConsent: granted,
          analyticsConsentAt: timestamp,
          updatedAt: timestamp,
        });

        // Update in-memory zustand state
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.getState().setUser({
            ...currentUser,
            analyticsConsent: granted,
            analyticsConsentAt: timestamp,
            updatedAt: timestamp,
          });
        }
      } catch (err) {
        console.warn('[Analytics] Failed to persist analytics consent to Firestore profile:', err);
      }
    }
  },

  /**
   * Synchronize consent state from user's loaded Firestore profile
   */
  syncConsentFromProfile(profile: Partial<UserProfile>): void {
    if (profile.analyticsConsent !== undefined) {
      const isGranted = profile.analyticsConsent === true;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DPA_CONSENT_KEY, isGranted ? 'granted' : 'denied');
        if (profile.analyticsConsentAt) {
          window.localStorage.setItem(DPA_CONSENT_AT_KEY, profile.analyticsConsentAt);
        }
      }

      const analytics = getAnalyticsInstance();
      if (analytics) {
        setAnalyticsCollectionEnabled(analytics, isGranted);
      }
    }
  },

  /**
   * Initialize Analytics conditionally based on user's saved DPA consent
   */
  initAnalyticsWithConsentGuard(): void {
    const consentGranted = this.hasDpaConsent();
    const analytics = getAnalyticsInstance();
    if (analytics) {
      setAnalyticsCollectionEnabled(analytics, consentGranted);
    }
  },

  /**
   * Log an analytics event (only executed if DPA consent has been explicitly granted)
   */
  logAnalyticsEvent(eventName: string, eventParams?: Record<string, unknown>): void {
    if (!this.hasDpaConsent()) {
      return; // Respect Kenya DPA 2019 privacy regulation - do not track
    }

    const analytics = getAnalyticsInstance();
    if (analytics) {
      try {
        logEvent(analytics, eventName, eventParams);
      } catch (err) {
        console.warn(`[Analytics] Failed to log event ${eventName}:`, err);
      }
    }
  },
};
