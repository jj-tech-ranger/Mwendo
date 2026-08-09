import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  enableMultiTabIndexedDbPersistence,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { getRemoteConfig, RemoteConfig } from 'firebase/remote-config';
import { getMessaging, Messaging, isSupported as isMessagingSupported } from 'firebase/messaging';
import { getAnalytics, Analytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);

const databaseId = firebaseConfigJson.firestoreDatabaseId;
export const db: Firestore = databaseId && databaseId !== '(default)'
  ? getFirestore(app, databaseId)
  : getFirestore(app);

// Enable offline persistence
try {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firestore] Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firestore] Persistence is not supported by browser');
    }
  });
} catch (e) {
  console.warn('[Firestore] Error configuring persistence:', e);
}

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
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY || firebaseConfigJson.recaptchaSiteKey) {
  try {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || firebaseConfigJson.recaptchaSiteKey;
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

