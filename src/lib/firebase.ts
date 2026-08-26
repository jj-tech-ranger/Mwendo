import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { getRemoteConfig, RemoteConfig } from 'firebase/remote-config';
import { getMessaging, Messaging, isSupported as isMessagingSupported } from 'firebase/messaging';
import {
  getAnalytics,
  Analytics,
  isSupported as isAnalyticsSupported,
  setAnalyticsCollectionEnabled,
} from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
const isTestEnv =
  import.meta.env.MODE === 'test' ||
  (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)));

export interface FirebaseConfigValidation {
  isValid: boolean;
  missingKeys: string[];
  isTestEnv: boolean;
  errorMessage: string | null;
}

const defaultTestConfig = {
  apiKey: 'AIzaSyFakeTestApiKeyForVitestSuite0123456789',
  authDomain: 'demo-mwendo-salama-audit.firebaseapp.com',
  projectId: 'demo-mwendo-salama-audit',
  storageBucket: 'demo-mwendo-salama-audit.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef1234567890abcdef',
};

const rawConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const REQUIRED_CONFIG_KEYS = [
  { key: 'apiKey', envVar: 'VITE_FIREBASE_API_KEY' },
  { key: 'authDomain', envVar: 'VITE_FIREBASE_AUTH_DOMAIN' },
  { key: 'projectId', envVar: 'VITE_FIREBASE_PROJECT_ID' },
  { key: 'storageBucket', envVar: 'VITE_FIREBASE_STORAGE_BUCKET' },
  { key: 'messagingSenderId', envVar: 'VITE_FIREBASE_MESSAGING_SENDER_ID' },
  { key: 'appId', envVar: 'VITE_FIREBASE_APP_ID' },
] as const;

const missingKeys = REQUIRED_CONFIG_KEYS
  .filter(({ key }) => {
    const val = rawConfig[key as keyof typeof rawConfig];
    return !val || typeof val !== 'string' || val.trim() === '' || val.startsWith('YOUR_');
  })
  .map(({ envVar }) => envVar);

export const firebaseConfigStatus: FirebaseConfigValidation = {
  isValid: isTestEnv || missingKeys.length === 0,
  missingKeys: isTestEnv ? [] : missingKeys,
  isTestEnv,
  errorMessage:
    !isTestEnv && missingKeys.length > 0
      ? `Missing required Firebase environment variable(s): ${missingKeys.join(', ')}. Please configure these in your .env file or deployment environment.`
      : null,
};

if (!firebaseConfigStatus.isValid && typeof window !== 'undefined') {
  console.error('[Firebase] Configuration validation error:', firebaseConfigStatus.errorMessage);
}

// In test environment or when config is missing, use safe fallback to avoid unhandled exceptions during module evaluation
const firebaseConfig = isTestEnv
  ? {
      apiKey: rawConfig.apiKey || defaultTestConfig.apiKey,
      authDomain: rawConfig.authDomain || defaultTestConfig.authDomain,
      projectId: rawConfig.projectId || defaultTestConfig.projectId,
      storageBucket: rawConfig.storageBucket || defaultTestConfig.storageBucket,
      messagingSenderId: rawConfig.messagingSenderId || defaultTestConfig.messagingSenderId,
      appId: rawConfig.appId || defaultTestConfig.appId,
    }
  : firebaseConfigStatus.isValid
  ? rawConfig
  : {
      apiKey: rawConfig.apiKey || 'missing-api-key',
      authDomain: rawConfig.authDomain || 'missing-auth-domain.firebaseapp.com',
      projectId: rawConfig.projectId || 'missing-project-id',
      storageBucket: rawConfig.storageBucket || 'missing-storage-bucket.appspot.com',
      messagingSenderId: rawConfig.messagingSenderId || '000000000000',
      appId: rawConfig.appId || '1:000000000000:web:000000000000',
    };

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
try {
  setLogLevel('error');
} catch {
  // Ignored if unsupported or already configured
}

export const storage: FirebaseStorage = getStorage(app);
export const functions: Functions = getFunctions(app, 'europe-west1');

const hasRealConfig =
  !isTestEnv &&
  firebaseConfigStatus.isValid &&
  Boolean(rawConfig.apiKey) &&
  rawConfig.apiKey !== 'missing-api-key' &&
  !rawConfig.apiKey.startsWith('YOUR_') &&
  !rawConfig.apiKey.startsWith('AIzaSyFake') &&
  !rawConfig.apiKey.toLowerCase().includes('dummy') &&
  !rawConfig.apiKey.toLowerCase().includes('placeholder') &&
  !rawConfig.apiKey.toLowerCase().includes('test') &&
  rawConfig.apiKey.length > 20;

let remoteConfigInstance: RemoteConfig | null = null;
export const getRemoteConfigInstance = (): RemoteConfig | null => {
  if (!remoteConfigInstance && hasRealConfig && typeof window !== 'undefined') {
    try {
      remoteConfigInstance = getRemoteConfig(app);
    } catch (e) {
      console.warn('[RemoteConfig] Failed to initialize RemoteConfig:', e);
      remoteConfigInstance = null;
    }
  }
  return remoteConfigInstance;
};
export const remoteConfig: RemoteConfig | null = null;

let messagingInstance: Messaging | null = null;
let isMessagingInitAttempted = false;

export const getMessagingInstance = (): Messaging | null => {
  if (!messagingInstance && !isMessagingInitAttempted && hasRealConfig && typeof window !== 'undefined') {
    isMessagingInitAttempted = true;
    try {
      isMessagingSupported()
        .then((supported) => {
          if (supported) {
            try {
              messagingInstance = getMessaging(app);
            } catch (e) {
              console.warn('[Messaging] Failed to initialize FCM:', e);
            }
          }
        })
        .catch(() => {
          // FCM not supported or network blocked
        });
    } catch {
      // Ignored
    }
  }
  return messagingInstance;
};

let analyticsInstance: Analytics | null = null;
let isAnalyticsInitAttempted = false;

export const getAnalyticsInstance = (): Analytics | null => {
  if (
    !analyticsInstance &&
    !isAnalyticsInitAttempted &&
    hasRealConfig &&
    typeof window !== 'undefined'
  ) {
    const hasStoredConsent =
      window.localStorage.getItem('mwendosalama_kenya_dpa_2019_consent') === 'granted';
    if (!hasStoredConsent) {
      return null;
    }

    isAnalyticsInitAttempted = true;
    try {
      isAnalyticsSupported()
        .then((supported) => {
          if (supported) {
            try {
              analyticsInstance = getAnalytics(app);
              setAnalyticsCollectionEnabled(analyticsInstance, true);
            } catch (e) {
              console.warn('[Analytics] Failed to initialize Analytics:', e);
            }
          }
        })
        .catch(() => {
          // Analytics not supported or blocked
        });
    } catch {
      // Ignored
    }
  }
  return analyticsInstance;
};

let appCheckInstance: AppCheck | null = null;
if (
  typeof window !== 'undefined' &&
  import.meta.env.MODE !== 'test' &&
  typeof indexedDB !== 'undefined' &&
  import.meta.env.VITE_RECAPTCHA_SITE_KEY
) {
  try {
    // App Check debug mode is strictly restricted to local development environments
    const isLocalHost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    const isDebugEnv = import.meta.env.DEV || isLocalHost;

    if (isDebugEnv) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey && siteKey !== 'undefined' && siteKey !== 'your-recaptcha-key') {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: !isDebugEnv,
      });
    }
  } catch (e) {
    console.warn('[AppCheck] App Check initialization skipped/handled:', e);
  }
}
export const getAppCheckInstance = () => appCheckInstance;

export default app;

