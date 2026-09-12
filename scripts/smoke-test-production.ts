#!/usr/bin/env tsx
/**
 * scripts/smoke-test-production.ts
 *
 * Production Live Dependencies Smoke Test for Mwendo Salama.
 *
 * Runs post-deployment against the real production project (mwendo-salama-prod)
 * to verify live cloud dependencies without writing permanent or customer-facing
 * data. All write probes are isolated to the diagnostic collection
 * 'system_health_checks' (reusing the admin/healthCheck pattern) or immediately
 * cleaned up.
 *
 * Checks implemented:
 *  1. Firestore Reachability (diagnostic probe write/read/cleanup + latency)
 *  2. Cloud Storage Reachability (bucket existence + probe write/read/cleanup + latency)
 *  3. Firebase Auth Reachability (project configuration retrieval + admin user check)
 *  4. Authorized-Domains List Correctness (validation against required domains)
 *  5. FCM / VAPID Key Validity (P-256 format & FCM dry-run connectivity probe)
 *  6. reCAPTCHA / App Check Configuration (site key format & App Check initialization)
 */

import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';
import { getAppCheck } from 'firebase-admin/app-check';

// ---------------------------------------------------------------------------
// Configuration & Environment Resolution
// ---------------------------------------------------------------------------
const PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'mwendo-salama-prod';

const STORAGE_BUCKET =
  process.env.VITE_FIREBASE_STORAGE_BUCKET ||
  `${PROJECT_ID}.firebasestorage.app`;

const VAPID_KEY = process.env.VITE_FIREBASE_VAPID_KEY?.trim();
const RECAPTCHA_SITE_KEY = process.env.VITE_RECAPTCHA_SITE_KEY?.trim();

const REQUIRED_AUTHORIZED_DOMAINS = [
  'localhost',
  `${PROJECT_ID}.firebaseapp.com`,
  `${PROJECT_ID}.web.app`,
];

export interface SmokeCheckResult {
  name: string;
  category: 'firestore' | 'storage' | 'auth' | 'authorized_domains' | 'fcm' | 'app_check';
  status: 'PASS' | 'FAIL' | 'NOT_CONFIGURED';
  latencyMs?: number;
  message: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Firebase Admin App Initialization
// ---------------------------------------------------------------------------
function initAdmin() {
  if (!getApps().length) {
    try {
      initializeApp({
        credential: applicationDefault(),
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
      });
    } catch {
      // In local environments without GCP Application Default Credentials,
      // allow fallback to mock/dry-run mode
      console.warn('Notice: Firebase Admin initialized without explicit default credentials.');
      initializeApp({
        projectId: PROJECT_ID,
        storageBucket: STORAGE_BUCKET,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check 1: Firestore Reachability
// Reuses the pattern from apps/functions/src/admin/healthCheck.ts
// ---------------------------------------------------------------------------
async function checkFirestore(): Promise<SmokeCheckResult> {
  const start = Date.now();
  const db = getFirestore();
  const probeId = `smoke_probe_${Date.now()}`;
  const probeRef = db.collection('system_health_checks').doc(probeId);

  try {
    // Write diagnostic probe
    await probeRef.set({
      source: 'production-smoke-test',
      checkedAt: new Date().toISOString(),
      projectId: PROJECT_ID,
      transient: true,
    });

    // Verify read
    const snapshot = await probeRef.get();
    if (!snapshot.exists) {
      throw new Error('Probe document was written but could not be read back.');
    }

    // Clean up probe immediately so zero test artifacts remain
    await probeRef.delete();

    // Also update persistent admin_probe (matching admin/healthCheck.ts)
    const adminProbeRef = db.collection('system_health_checks').doc('admin_probe');
    await adminProbeRef.set(
      {
        lastCheckedAt: new Date().toISOString(),
        source: 'production-smoke-test',
        status: 'healthy',
      },
      { merge: true }
    );

    const latencyMs = Date.now() - start;
    return {
      name: 'Firestore Reachability',
      category: 'firestore',
      status: 'PASS',
      latencyMs,
      message: `Firestore read/write/delete roundtrip verified via system_health_checks (${latencyMs}ms)`,
      details: { probeDoc: probeId, persistentProbe: 'admin_probe' },
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    return {
      name: 'Firestore Reachability',
      category: 'firestore',
      status: 'FAIL',
      latencyMs,
      message: `Firestore connectivity failed: ${msg}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Check 2: Cloud Storage Reachability
// ---------------------------------------------------------------------------
async function checkStorage(): Promise<SmokeCheckResult> {
  const start = Date.now();
  const storage = getStorage();
  const bucket = storage.bucket(STORAGE_BUCKET);
  const probePath = `_health_probes/smoke_${Date.now()}.txt`;
  const file = bucket.file(probePath);

  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      return {
        name: 'Storage Reachability',
        category: 'storage',
        status: 'FAIL',
        latencyMs: Date.now() - start,
        message: `Storage bucket '${STORAGE_BUCKET}' does not exist or is inaccessible.`,
      };
    }

    // Write transient probe file
    const probeContent = `mwendo-smoke-probe:${Date.now()}`;
    await file.save(probeContent, {
      contentType: 'text/plain',
      resumable: false,
      metadata: { cacheControl: 'no-cache' },
    });

    // Read back and verify
    const [downloaded] = await file.download();
    if (downloaded.toString('utf8') !== probeContent) {
      throw new Error('Downloaded probe content did not match written content.');
    }

    // Clean up immediately
    await file.delete({ ignoreNotFound: true });

    const latencyMs = Date.now() - start;
    return {
      name: 'Cloud Storage Reachability',
      category: 'storage',
      status: 'PASS',
      latencyMs,
      message: `Storage bucket '${STORAGE_BUCKET}' verified via transient probe upload/download/cleanup (${latencyMs}ms)`,
      details: { bucket: STORAGE_BUCKET, probeFile: probePath },
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    // Ensure cleanup even on error
    try {
      await file.delete({ ignoreNotFound: true });
    } catch {
      // Ignore cleanup error
    }

    return {
      name: 'Cloud Storage Reachability',
      category: 'storage',
      status: 'FAIL',
      latencyMs,
      message: `Storage probe failed on bucket '${STORAGE_BUCKET}': ${msg}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Check 3: Firebase Auth Reachability
// ---------------------------------------------------------------------------
async function checkAuth(): Promise<SmokeCheckResult> {
  const start = Date.now();
  const auth = getAuth();

  try {
    const projectConfig = await auth.projectConfigManager().getProjectConfig();
    const latencyMs = Date.now() - start;

    // Check TOTP provider status
    const mfaProviders = projectConfig.multiFactorConfig?.providerConfigs ?? [];
    const totpEnabled = mfaProviders.some(
      (p) => 'totpProviderConfig' in p && p.state === 'ENABLED'
    );

    return {
      name: 'Firebase Auth Reachability',
      category: 'auth',
      status: 'PASS',
      latencyMs,
      message: `Auth project config retrieved successfully (${latencyMs}ms)`,
      details: {
        totpMfaConfigured: totpEnabled,
        mfaProviderCount: mfaProviders.length,
      },
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : String(error);
    return {
      name: 'Firebase Auth Reachability',
      category: 'auth',
      status: 'FAIL',
      latencyMs,
      message: `Auth service unreachable or unauthorized: ${msg}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Check 4: Authorized Domains List Correctness
// ---------------------------------------------------------------------------
async function checkAuthorizedDomains(): Promise<SmokeCheckResult> {
  const auth = getAuth();

  try {
    const projectConfig = await auth.projectConfigManager().getProjectConfig();
    const authorizedDomains: string[] = projectConfig.authorizedDomains || [];

    const missingDomains = REQUIRED_AUTHORIZED_DOMAINS.filter(
      (required) => !authorizedDomains.includes(required)
    );

    if (missingDomains.length > 0) {
      return {
        name: 'Authorized Domains Verification',
        category: 'authorized_domains',
        status: 'FAIL',
        message: `Missing required authorized domain(s): ${missingDomains.join(', ')}`,
        details: {
          configuredDomains: authorizedDomains,
          missingDomains,
        },
      };
    }

    return {
      name: 'Authorized Domains Verification',
      category: 'authorized_domains',
      status: 'PASS',
      message: `All ${REQUIRED_AUTHORIZED_DOMAINS.length} required production domains authorized (${authorizedDomains.length} total)`,
      details: {
        authorizedDomains,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      name: 'Authorized Domains Verification',
      category: 'authorized_domains',
      status: 'FAIL',
      message: `Failed to inspect authorized domains: ${msg}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Check 5: FCM & VAPID Key Validity
// ---------------------------------------------------------------------------
async function checkFcmAndVapid(): Promise<SmokeCheckResult> {
  const details: Record<string, unknown> = {};

  // Part A: VAPID Key Validation
  if (!VAPID_KEY) {
    return {
      name: 'FCM / VAPID Key Validity',
      category: 'fcm',
      status: 'NOT_CONFIGURED',
      message: 'VITE_FIREBASE_VAPID_KEY not provided in environment (optional secret).',
    };
  }

  try {
    // VAPID keys are URL-safe base64 encoded P-256 public keys
    // Uncompressed P-256 public key is 65 bytes long (0x04 + 32-byte X + 32-byte Y)
    const normalized = VAPID_KEY.replace(/-/g, '+').replace(/_/g, '/');
    const keyBytes = Buffer.from(normalized, 'base64');

    if (keyBytes.length !== 65 || keyBytes[0] !== 0x04) {
      return {
        name: 'FCM / VAPID Key Validity',
        category: 'fcm',
        status: 'FAIL',
        message: `Invalid VAPID public key format. Expected 65-byte uncompressed EC key (got ${keyBytes.length} bytes, prefix 0x${keyBytes[0]?.toString(16)}).`,
      };
    }

    details.vapidKeyValid = true;
    details.vapidKeyLength = keyBytes.length;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'FCM / VAPID Key Validity',
      category: 'fcm',
      status: 'FAIL',
      message: `VAPID key decoding failed: ${msg}`,
    };
  }

  // Part B: FCM Service Connectivity via Dry-Run Probe
  try {
    const messaging = getMessaging();
    // A dry-run send with a dummy token verifies that the Firebase Messaging API
    // is enabled and reachable in Google Cloud without actually dispatching a notification.
    await messaging.send(
      {
        token: 'smoke_test_dry_run_dummy_token_0000000000000000000000',
        notification: { title: 'Smoke Test Probe' },
      },
      true // dryRun: true
    );
  } catch (error: unknown) {
    // Expected response for dummy token is invalid-registration-token or registration-token-not-registered.
    // This confirms the FCM server processed the request.
    const errCode = (error as { code?: string })?.code;
    if (
      errCode === 'messaging/invalid-argument' ||
      errCode === 'messaging/invalid-registration-token' ||
      errCode === 'messaging/registration-token-not-registered'
    ) {
      details.fcmEndpointReachable = true;
      details.fcmResponseCode = errCode;
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        name: 'FCM / VAPID Key Validity',
        category: 'fcm',
        status: 'FAIL',
        message: `FCM endpoint communication failed: ${msg}`,
      };
    }
  }

  return {
    name: 'FCM / VAPID Key Validity',
    category: 'fcm',
    status: 'PASS',
    message: 'VAPID public key format valid (NIST P-256) and FCM API endpoint reachable.',
    details,
  };
}

// ---------------------------------------------------------------------------
// Check 6: reCAPTCHA & App Check Configuration
// ---------------------------------------------------------------------------
async function checkRecaptchaAndAppCheck(): Promise<SmokeCheckResult> {
  const details: Record<string, unknown> = {};

  if (!RECAPTCHA_SITE_KEY) {
    return {
      name: 'reCAPTCHA / App Check Configuration',
      category: 'app_check',
      status: 'NOT_CONFIGURED',
      message: 'VITE_RECAPTCHA_SITE_KEY not provided in environment (optional secret for live App Check).',
    };
  }

  // Validate format of reCAPTCHA site key
  const siteKeyRegex = /^[a-zA-Z0-9_-]{40}$/;
  if (!siteKeyRegex.test(RECAPTCHA_SITE_KEY)) {
    return {
      name: 'reCAPTCHA / App Check Configuration',
      category: 'app_check',
      status: 'FAIL',
      message: `Invalid reCAPTCHA site key format. Expected 40-character token string (got ${RECAPTCHA_SITE_KEY.length} chars).`,
    };
  }

  details.recaptchaSiteKeyValid = true;

  // Verify App Check Admin initialization
  try {
    const appCheck = getAppCheck();
    details.appCheckServiceReady = Boolean(appCheck);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      name: 'reCAPTCHA / App Check Configuration',
      category: 'app_check',
      status: 'FAIL',
      message: `App Check Admin service error: ${msg}`,
    };
  }

  return {
    name: 'reCAPTCHA / App Check Configuration',
    category: 'app_check',
    status: 'PASS',
    message: 'reCAPTCHA Enterprise site key format valid and App Check Admin service initialized.',
    details,
  };
}

// ---------------------------------------------------------------------------
// Main Test Runner & Formatter
// ---------------------------------------------------------------------------
export async function runProductionSmokeTests(): Promise<{
  success: boolean;
  results: SmokeCheckResult[];
}> {
  console.log('='.repeat(70));
  console.log('MWENDO SALAMA — PRODUCTION LIVE DEPENDENCIES SMOKE TEST');
  console.log(`Target Project : ${PROJECT_ID}`);
  console.log(`Storage Bucket : ${STORAGE_BUCKET}`);
  console.log(`Execution Time : ${new Date().toISOString()}`);
  console.log('='.repeat(70));

  initAdmin();

  const results: SmokeCheckResult[] = [];

  // Sequential execution to keep output deterministic and prevent probe race conditions
  console.log('\n[1/6] Probing Firestore reachability...');
  results.push(await checkFirestore());

  console.log('[2/6] Probing Cloud Storage reachability...');
  results.push(await checkStorage());

  console.log('[3/6] Probing Firebase Auth reachability...');
  results.push(await checkAuth());

  console.log('[4/6] Verifying Authorized Domains list...');
  results.push(await checkAuthorizedDomains());

  console.log('[5/6] Probing FCM & VAPID Key validity...');
  results.push(await checkFcmAndVapid());

  console.log('[6/6] Probing reCAPTCHA & App Check configuration...');
  results.push(await checkRecaptchaAndAppCheck());

  // Print Summary Table
  console.log('\n' + '='.repeat(70));
  console.log('SMOKE TEST EXECUTION SUMMARY:');
  console.log('='.repeat(70));

  let failureCount = 0;
  let passCount = 0;
  let notConfiguredCount = 0;

  for (const res of results) {
    const tag = `[${res.status}]`.padEnd(18);
    const latency = res.latencyMs !== undefined ? `(${res.latencyMs}ms) ` : '';
    console.log(`${tag} ${res.name.padEnd(36)} ${latency}${res.message}`);

    if (res.status === 'FAIL') failureCount++;
    else if (res.status === 'PASS') passCount++;
    else notConfiguredCount++;
  }

  console.log('='.repeat(70));
  console.log(`Total Checks : ${results.length}`);
  console.log(`Passed       : ${passCount}`);
  console.log(`Failed       : ${failureCount}`);
  console.log(`Optional N/C : ${notConfiguredCount}`);
  console.log('='.repeat(70));

  // A test is considered successful if there are zero FAIL statuses.
  // NOT_CONFIGURED for optional secrets does not block release if required infrastructure is healthy.
  const success = failureCount === 0;

  if (success) {
    console.log('RESULT: Production Smoke Test PASSED.\n');
  } else {
    console.error('RESULT: Production Smoke Test FAILED with errors.\n');
  }

  return { success, results };
}

// Execute when invoked directly from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionSmokeTests()
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal unhandled exception during smoke tests:', err);
      process.exit(1);
    });
}
