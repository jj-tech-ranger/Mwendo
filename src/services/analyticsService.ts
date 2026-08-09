import { setAnalyticsCollectionEnabled, logEvent } from 'firebase/analytics';
import { getAnalyticsInstance } from '../lib/firebase';

const DPA_CONSENT_KEY = 'mwendosalama_kenya_dpa_2019_consent';

export const analyticsService = {
  /**
   * Check if user has granted explicit consent under Kenya Data Protection Act (DPA) 2019
   */
  hasDpaConsent(): boolean {
    return window.localStorage.getItem(DPA_CONSENT_KEY) === 'granted';
  },

  /**
   * Set explicit DPA 2019 consent state and configure Firebase Analytics collection
   */
  async setDpaConsent(granted: boolean): Promise<void> {
    window.localStorage.setItem(DPA_CONSENT_KEY, granted ? 'granted' : 'denied');

    const analytics = getAnalyticsInstance();
    if (analytics) {
      setAnalyticsCollectionEnabled(analytics, granted);
      console.log(`[Analytics] Kenya DPA 2019 consent set to: ${granted}`);
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
  logAnalyticsEvent(eventName: string, eventParams?: Record<string, any>): void {
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
