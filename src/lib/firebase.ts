import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { getRemoteConfig, RemoteConfig } from 'firebase/remote-config';
import { getMessaging, Messaging, isSupported as isMessagingSupported } from 'firebase/messaging';
import { getAnalytics, Analytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('[Firebase] Missing required Firebase environment variables! Check your .env file.');
}

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
let dbInstance: Firestore;
try {
  const cacheSettings = {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  };
  dbInstance = databaseId && databaseId !== '(default)'
    ? initializeFirestore(app, cacheSettings, databaseId)
    : initializeFirestore(app, cacheSettings);
} catch {
  dbInstance = databaseId && databaseId !== '(default)'
    ? getFirestore(app, databaseId)
    : getFirestore(app);
}

export const db: Firestore = dbInstance;

export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app);
export const remoteConfig: RemoteConfig = getRemoteConfig(app);

let messagingInstance: Messaging | null = null;
isMessagingSupported().then((supported) => {
  if (supported) {
    try {
      messagingInstance = getMessaging(app);
    } catch (e) {
      console.warn('[Messaging] Failed to initialize FCM:', e);
    }
  }
});
export const getMessagingInstance = () => messagingInstance;

let analyticsInstance: Analytics | null = null;
isAnalyticsSupported().then((supported) => {
  if (supported) {
    try {
      analyticsInstance = getAnalytics(app);
    } catch (e) {
      console.warn('[Analytics] Failed to initialize Analytics:', e);
    }
  }
});
export const getAnalyticsInstance = () => analyticsInstance;

let appCheckInstance: AppCheck | null = null;
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  try {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.warn('[AppCheck] App Check initialization skipped/failed:', e);
  }
}
export const getAppCheckInstance = () => appCheckInstance;

export default app;

