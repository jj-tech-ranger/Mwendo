import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance } from '../lib/firebase';
import { SafetyAlert } from '../types';

export const messagingService = {
  /**
   * Request FCM Push Notification Permission & Retrieve Registration Token
   */
  async requestNotificationPermission(vapidKey?: string): Promise<string | null> {
    const messaging = getMessagingInstance();
    if (!messaging) {
      console.warn('[FCM] Messaging not supported or available');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, {
          vapidKey: vapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });
        console.log('[FCM] Registration token retrieved:', token);
        return token;
      }
      console.warn('[FCM] Notification permission denied');
      return null;
    } catch (err) {
      console.warn('[FCM] Token retrieval failed:', err);
      return null;
    }
  },

  /**
   * Attach listener for foreground FCM push notifications
   */
  onForegroundNotification(callback: (payload: any) => void): (() => void) | null {
    const messaging = getMessagingInstance();
    if (!messaging) return null;

    return onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground notification received:', payload);
      callback(payload);
    });
  },

  /**
   * Dispatch real-time FCM notification trigger payload for SOS or critical safety alert
   */
  async dispatchSOSAlertPush(alert: SafetyAlert): Promise<void> {
    console.log(`[FCM] Dispatching SOS push notification for trip ${alert.tripId}:`, alert.message);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`🚨 Emergency SOS Alert: ${alert.vehicleRegNumber}`, {
          body: `${alert.message} at speed ${alert.speedKmH} km/h`,
          icon: '/assets/icon-sos.png',
          tag: `sos_${alert.tripId}`,
        });
      } catch (err) {
        console.warn('[FCM] Browser native notification display failed:', err);
      }
    }
  },
};
