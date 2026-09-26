// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { processReportBlackSpotLogic, ReportBlackSpotPayload } from '../../apps/functions/src/reports/reportBlackSpot';

const PROJECT_ID = 'demo-mwendo-salama-rules';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

let testEnv: RulesTestEnvironment | null = null;
let adminApp: App | null = null;
let adminDb: Firestore | null = null;

function emulatorEndpoint(value: string, fallbackPort: number) {
  const [host, port] = value.split(':');
  return { host, port: Number(port ?? fallbackPort) };
}

function authedClientDb(uid: string, activeRole = 'passenger') {
  if (!testEnv) throw new Error('RulesTestEnvironment not initialized');
  return testEnv
    .authenticatedContext(uid, {
      activeRole,
      firebase: { sign_in_provider: 'custom' },
    })
    .firestore();
}

let emulatorOnline = false;

beforeAll(async () => {
  const firestore = emulatorEndpoint(FIRESTORE_EMULATOR_HOST, 8080);
  process.env.FIRESTORE_EMULATOR_HOST = `${firestore.host}:${firestore.port}`;
  process.env.GCLOUD_PROJECT = PROJECT_ID;

  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: firestore.host,
        port: firestore.port,
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
    emulatorOnline = true;

    if (getApps().length === 0) {
      adminApp = initializeApp({ projectId: PROJECT_ID });
    } else {
      adminApp = getApps()[0]!;
    }
    adminDb = getFirestore(adminApp);
  } catch (err: any) {
    const isOfflineOrNginx =
      typeof err?.message === 'string' &&
      (err.message.includes('405') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('Not Allowed'));
    if (isOfflineOrNginx) {
      console.info(
        `[offline-idempotency.test] Firestore emulator not active on ${firestore.host}:${firestore.port}. Tests skipped gracefully.`
      );
    } else {
      console.warn('[offline-idempotency.test] Failed to initialize Firestore test environment:', err);
    }
  }
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async (ctx) => {
  if (!emulatorOnline || !testEnv) {
    ctx.skip();
    return;
  }
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

describe('Audit Test C: Offline Sync Idempotency Keys & processedEvents Ledger Verification', () => {
  it('Test C: queueing a black-spot report offline and retrying twice creates exactly ONE black_spots document without inflating corroborations', async () => {
    if (!adminDb || !testEnv) throw new Error('Environment not initialized');

    const userId = 'passenger_commuter_c1';
    const clientDb = authedClientDb(userId, 'passenger');

    // Seed reporter profile with verified email so they have valid permissions and trust score
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', userId), {
        uid: userId,
        email: 'commuter_c1@mwendosalama.co.ke',
        role: 'passenger',
        activeRole: 'passenger',
        isVerified: true,
        trustScore: 0.8,
        createdAt: new Date().toISOString(),
      });
    });

    // 1. Client queues black spot offline:
    // A distinct client-side idempotency UUID is stamped on the mutation at queue time.
    const clientGeneratedSpotId = `bs_offline_${Date.now()}`;
    const idempotencyKey = `uuid-offline-sync-c-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const queuedPayload: ReportBlackSpotPayload = {
      id: clientGeneratedSpotId,
      idempotencyKey,
      title: 'Oil Slick Hazard near Waiyaki Way Flyover',
      description: 'Major engine oil spill causing Matatu slippage on the left lane.',
      hazardType: 'accident_prone',
      severity: 'high',
      latitude: -1.2635,
      longitude: 36.8025,
      location: { lat: -1.2635, lng: 36.8025 },
      locationName: 'Waiyaki Way Flyover',
      routeName: 'Nairobi - Westlands',
      reportedByUid: userId,
      reportedByDisplayName: 'Commuter Alice',
    };

    // 2. First execution attempt (simulating online reconnect drain attempt #1):
    // The server processes the mutation, writes to Firestore, but the HTTP response drops
    // or times out before reaching the client.
    const resultAttempt1 = await processReportBlackSpotLogic(adminDb, queuedPayload, userId);
    expect(resultAttempt1.success).toBe(true);
    expect(resultAttempt1.spotId).toBe(clientGeneratedSpotId);
    expect(resultAttempt1.corroborated).toBe(false);
    expect(resultAttempt1.alreadyProcessed).toBeUndefined();

    // 3. Second execution attempt (simulating the client offline queue retrying the SAME mutation):
    // The client re-submits the exact same queued payload with the exact same idempotencyKey.
    const resultAttempt2 = await processReportBlackSpotLogic(adminDb, queuedPayload, userId);

    // Assert: Retry returns success with alreadyProcessed flag
    expect(resultAttempt2.success).toBe(true);
    expect(resultAttempt2.spotId).toBe(clientGeneratedSpotId);
    expect(resultAttempt2.alreadyProcessed).toBe(true);

    // 4. Assert Firestore state against real emulator:
    // Exactly ONE black_spots document must exist for this spotId
    const spotDocSnap = await getDoc(doc(clientDb, 'black_spots', clientGeneratedSpotId));
    expect(spotDocSnap.exists()).toBe(true);
    const spotData = spotDocSnap.data()!;

    // Corroboration count must remain 1, NOT artificially incremented to 2 by the retry
    expect(spotData.corroborationCount ?? spotData.corroborationsCount).toBe(1);
    expect(spotData.status).toBe('pending');
    expect(spotData.title).toBe('Oil Slick Hazard near Waiyaki Way Flyover');

    // Exactly ONE subcollection report under black_spots/{spotId}/reports
    const reportsQuery = await getDocs(collection(clientDb, 'black_spots', clientGeneratedSpotId, 'reports'));
    expect(reportsQuery.docs.length).toBe(1);
    expect(reportsQuery.docs[0]?.data().spotId).toBe(clientGeneratedSpotId);

    // Verify processedEvents ledger entry exists and is written strictly by the Cloud Function
    const expectedLedgerDocId = `bs_${userId}_${idempotencyKey}`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const ledgerSnap = await getDoc(doc(context.firestore(), 'processedEvents', expectedLedgerDocId));
      expect(ledgerSnap.exists()).toBe(true);
      const ledgerData = ledgerSnap.data()!;
      expect(ledgerData.eventId).toBe(expectedLedgerDocId);
      expect(ledgerData.handler).toBe('reportBlackSpot');
      expect(ledgerData.userId).toBe(userId);
      expect(ledgerData.spotId).toBe(clientGeneratedSpotId);
    });

    // 5. Simulate third consecutive retry: must still be idempotent and return identical result
    const resultAttempt3 = await processReportBlackSpotLogic(adminDb, queuedPayload, userId);
    expect(resultAttempt3.success).toBe(true);
    expect(resultAttempt3.alreadyProcessed).toBe(true);

    const postAttempt3Snap = await getDoc(doc(clientDb, 'black_spots', clientGeneratedSpotId));
    expect(postAttempt3Snap.data()?.corroborationsCount ?? postAttempt3Snap.data()?.corroborationCount).toBe(1);
  });

  it('SECURITY: prevents cross-user idempotency collision or tampering', async () => {
    if (!adminDb || !testEnv) throw new Error('Environment not initialized');

    const userAlice = 'user_alice_victim';
    const userBob = 'user_bob_attacker';

    // Alice queues and executes report with key
    const sharedIdempotencyKey = 'shared-uuid-collision-test';
    const aliceSpotId = `bs_alice_${Date.now()}`;

    const alicePayload: ReportBlackSpotPayload = {
      id: aliceSpotId,
      idempotencyKey: sharedIdempotencyKey,
      title: 'Pothole on Jogoo Road',
      latitude: -1.2921,
      longitude: 36.8521,
      location: { lat: -1.2921, lng: 36.8521 },
      severity: 'medium',
      hazardType: 'pothole',
      reportedByUid: userAlice,
    };

    const aliceResult = await processReportBlackSpotLogic(adminDb, alicePayload, userAlice);
    expect(aliceResult.success).toBe(true);
    expect(aliceResult.spotId).toBe(aliceSpotId);

    // Bob attempts to submit with the exact same idempotencyKey
    const bobSpotId = `bs_bob_${Date.now()}`;
    const bobPayload: ReportBlackSpotPayload = {
      id: bobSpotId,
      idempotencyKey: sharedIdempotencyKey,
      title: 'Different Pothole jogoo road',
      latitude: -1.2925,
      longitude: 36.8525,
      location: { lat: -1.2925, lng: 36.8525 },
      severity: 'low',
      hazardType: 'pothole',
      reportedByUid: userBob,
    };

    // Because ledger doc ID is scoped to `bs_${userId}_${key}`, Bob's submission
    // does not collide with Alice's ledger entry and creates Bob's own scoped ledger entry
    const bobResult = await processReportBlackSpotLogic(adminDb, bobPayload, userBob);
    expect(bobResult.success).toBe(true);

    // Both ledger entries must exist independently
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const aliceLedger = await getDoc(doc(context.firestore(), 'processedEvents', `bs_${userAlice}_${sharedIdempotencyKey}`));
      const bobLedger = await getDoc(doc(context.firestore(), 'processedEvents', `bs_${userBob}_${sharedIdempotencyKey}`));
      expect(aliceLedger.exists()).toBe(true);
      expect(bobLedger.exists()).toBe(true);
      expect(aliceLedger.data()?.userId).toBe(userAlice);
      expect(bobLedger.data()?.userId).toBe(userBob);
    });
  });

  it('SECURITY RULES: clients cannot tamper with or write to /processedEvents directly', async () => {
    const clientDb = authedClientDb('passenger_mallory', 'passenger');
    await assertFails(
      setDoc(doc(clientDb, 'processedEvents', 'forged_event_123'), {
        eventId: 'forged_event_123',
        handler: 'reportBlackSpot',
        processedAt: new Date().toISOString(),
      })
    );
  });
});
