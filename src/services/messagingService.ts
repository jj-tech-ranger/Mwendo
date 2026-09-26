import { getToken, onMessage, isSupported as isMessagingSupported, getMessaging } from 'firebase/messaging';
import app, { getMessagingInstance } from '../lib/firebase';
import { SafetyAlert } from '../types';
import { functionsService } from './functionsService';
import { useAuthStore } from '../store/useAuthStore';

export interface PushRegistrationResult {
  success: boolean;
  token: string | null;
  permission: NotificationPermission | 'unsupported';
  error?: string | undefined;
}

export const messagingService = {
  /**
   * Check if browser environment supports Web Push Notifications
   */
  async isPushSupported(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }
    try {
      return await isMessagingSupported();
    } catch {
      return false;
    }
  },

  /**
   * Return the current browser notification permission state
   */
  getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  },

  /**
   * Request FCM Push Notification Permission & Retrieve Registration Token
   */
  async requestNotificationPermission(vapidKey?: string): Promise<string | null> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[FCM] Notifications not supported in this environment');
      return null;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[FCM] Notification permission denied or dismissed');
        return null;
      }

      let messaging = getMessagingInstance();
      if (!messaging) {
        const supported = await isMessagingSupported().catch(() => false);
        if (supported) {
          try {
            messaging = getMessaging(app);
          } catch (e) {
            console.warn('[FCM] Failed to initialize Messaging instance:', e);
          }
        }
      }

      const activeVapidKey = vapidKey || import.meta.env.VITE_FIREBASE_VAPID_KEY;

      if (!messaging) {
        console.warn('[FCM] Messaging instance unavailable');
        // If permission is granted in emulator/dev without messaging SDK support, generate a client surrogate
        if (import.meta.env.DEV) {
          const devToken = `dev_token_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          return devToken;
        }
        return null;
      }

      // Try registering with service worker
      let swRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          swRegistration = await navigator.serviceWorker.ready;
        } catch {
          // Fall back to default sw registration
        }
      }

      try {
        const options: { vapidKey?: string; serviceWorkerRegistration?: ServiceWorkerRegistration } = {};
        if (activeVapidKey) {
          options.vapidKey = activeVapidKey;
        }
        if (swRegistration) {
          options.serviceWorkerRegistration = swRegistration;
        }

        const token = await getToken(messaging, options);
        if (token) {
          console.log('[FCM] Device registration token retrieved successfully');
          return token;
        }
      } catch (tokenErr: unknown) {
        console.warn('[FCM] Token retrieval failed with active VAPID key:', tokenErr);
        // If VAPID key is absent in local dev/demo mode, generate a development device token
        if (!activeVapidKey && import.meta.env.DEV) {
          console.info('[FCM] VITE_FIREBASE_VAPID_KEY is absent; using demo device token for local testing');
          return `demo_fcm_token_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        }
      }

      return null;
    } catch (err) {
      console.warn('[FCM] Token retrieval failed:', err);
      return null;
    }
  },

  /**
   * End-to-end Token Lifecycle: Request permission, retrieve FCM token, and persist in backend
   */
  async registerPushNotifications(vapidKey?: string): Promise<PushRegistrationResult> {
    const permission = this.getPermissionStatus();
    if (permission === 'unsupported') {
      return {
        success: false,
        token: null,
        permission: 'unsupported',
        error: 'Push notifications are not supported by this browser.',
      };
    }

    try {
      const token = await this.requestNotificationPermission(vapidKey);
      const updatedPermission = this.getPermissionStatus();

      if (!token) {
        return {
          success: false,
          token: null,
          permission: updatedPermission,
          error:
            updatedPermission === 'denied'
              ? 'Notification permission was denied in browser settings.'
              : 'Unable to retrieve FCM device token. Check VAPID configuration.',
        };
      }

      // Persist token via callable Cloud Function (with Firestore subcollection fallback)
      await functionsService.registerDeviceToken({
        token,
        platform: 'web',
      });

      // Update auth store with active token
      useAuthStore.setState((s) => {
        if (!s.user) return s;
        return {
          ...s,
          user: {
            ...s.user,
            fcmToken: token,
          },
        };
      });

      return {
        success: true,
        token,
        permission: updatedPermission,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[FCM] Error registering push notifications:', err);
      return {
        success: false,
        token: null,
        permission: this.getPermissionStatus(),
        error: message,
      };
    }
  },

  /**
   * Unregister FCM push notifications and prune token from backend
   */
  async unregisterPushNotifications(tokenOverride?: string): Promise<boolean> {
    const currentUser = useAuthStore.getState().user;
    const token = tokenOverride || currentUser?.fcmToken;

    if (token) {
      try {
        await functionsService.unregisterDeviceToken({ token });
      } catch (err) {
        console.warn('[FCM] Error calling unregisterDeviceToken:', err);
      }
    }

    useAuthStore.setState((s) => {
      if (!s.user) return s;
      return {
        ...s,
        user: {
          ...s.user,
          fcmToken: undefined,
        },
      };
    });

    return true;
  },

  /**
   * Attach listener for foreground FCM push notifications
   */
  onForegroundNotification(callback: (payload: unknown) => void): (() => void) | null {
    const messaging = getMessagingInstance();
    if (!messaging) return null;

    try {
      return onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground notification received:', payload);
        callback(payload);
      });
    } catch (err) {
      console.warn('[FCM] Could not attach foreground notification listener:', err);
      return null;
    }
  },

  /**
   * Dispatch real-time foreground notification fallback for SOS or critical safety alert (§12).
   * Kept as a same-device foreground fallback even after real FCM is wired,
   * since it costs nothing and helps when a token isn't yet registered.
   */
  async dispatchSOSAlertPush(alert: SafetyAlert): Promise<void> {
    console.log(`[FCM] Dispatching SOS push notification for trip ${alert.tripId}:`, alert.message);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
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
