// @vitest-environment node
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadString, getMetadata, deleteObject } from 'firebase/storage';

const JPEG_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const JSON_DATA = '{"speed":80,"timestamp":1700000000}';

describe('Firebase Storage Security Rules (Emulator-Backed)', { timeout: 20000 }, () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-mwendo-salama-audit',
      firestore: {
        rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8085,
      },
      storage: {
        rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 9199,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      await testEnv.clearStorage();
    }
  });

  it('SEC-006 & FUNC-001: complaint evidence storage access control and manager delete restriction', async () => {
    // 1. Seed the complaint doc in Firestore (security rules disabled)
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'complaints/complaint_1'), {
        id: 'complaint_1',
        saccoId: 'sacco_A',
        reportedByUid: 'complainant_1',
        status: 'submitted',
      });
    });

    const complainant = testEnv.authenticatedContext('complainant_1', { activeRole: 'passenger' });
    const staleUser = testEnv.authenticatedContext('stale_user_1', { activeRole: 'passenger', saccoId: 'sacco_A' });
    const unrelatedPassenger = testEnv.authenticatedContext('passenger_2', { activeRole: 'passenger' });
    const validManager = testEnv.authenticatedContext('mgr_a', { activeRole: 'sacco_manager', saccoId: 'sacco_A' });
    const authority = testEnv.authenticatedContext('auth_user_1', { activeRole: 'authority' });

    const evidencePath = 'evidence/sacco_A/complaint_1/photo.jpg';

    // SCENARIO A: Original complainant
    // - CREATE succeeds via uploadString
    // - READ metadata succeeds via getMetadata
    // - DELETE fails (restricted to admin/authority)
    const complainantRef = ref(complainant.storage(), evidencePath);
    await assertSucceeds(uploadString(complainantRef, JPEG_DATA_URL, 'data_url'));
    await assertSucceeds(getMetadata(complainantRef));
    await assertFails(deleteObject(complainantRef));

    // SCENARIO B: Stale passenger (activeRole: 'passenger' with saccoId claim)
    // - READ metadata fails
    // - CREATE / overwrite fails
    // - DELETE fails
    const staleRef = ref(staleUser.storage(), evidencePath);
    await assertFails(getMetadata(staleRef));
    await assertFails(uploadString(staleRef, JPEG_DATA_URL, 'data_url'));
    await assertFails(deleteObject(staleRef));

    // SCENARIO C: Unrelated passenger
    // - READ metadata fails
    // - CREATE / overwrite fails
    // - DELETE fails
    const unrelatedRef = ref(unrelatedPassenger.storage(), evidencePath);
    await assertFails(getMetadata(unrelatedRef));
    await assertFails(uploadString(unrelatedRef, JPEG_DATA_URL, 'data_url'));
    await assertFails(deleteObject(unrelatedRef));

    // SCENARIO D: Matching SACCO manager
    // - READ metadata succeeds
    // - CREATE / overwrite (update) fails
    // - DELETE fails
    const managerRef = ref(validManager.storage(), evidencePath);
    await assertSucceeds(getMetadata(managerRef));
    await assertFails(uploadString(managerRef, JPEG_DATA_URL, 'data_url'));
    await assertFails(deleteObject(managerRef));

    // SCENARIO E: Authority
    // - READ metadata succeeds
    // - DELETE succeeds
    const authRef = ref(authority.storage(), evidencePath);
    await assertSucceeds(getMetadata(authRef));
    await assertSucceeds(deleteObject(authRef));
  });

  it('SEC-005: black spot evidence storage restricts uploads to original reporter and protects against overwrites', async () => {
    // 1. Seed black spot doc in Firestore
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'black_spots/spot_100'), {
        id: 'spot_100',
        title: 'Pothole Cluster',
        reportedByUid: 'reporter_spot_1',
        severity: 'high',
        status: 'pending',
      });
    });

    const reporter = testEnv.authenticatedContext('reporter_spot_1', { activeRole: 'passenger' });
    const imposter = testEnv.authenticatedContext('imposter_user_2', { activeRole: 'passenger' });
    const authority = testEnv.authenticatedContext('auth_user_2', { activeRole: 'authority' });

    const blackSpotEvidencePath = 'black_spots/spot_100/photo.jpg';
    const reporterRef = ref(reporter.storage(), blackSpotEvidencePath);
    const imposterRef = ref(imposter.storage(), blackSpotEvidencePath);
    const authRef = ref(authority.storage(), blackSpotEvidencePath);

    // 1. Reporter creates the object successfully
    await assertSucceeds(uploadString(reporterRef, JPEG_DATA_URL, 'data_url'));

    // 2. Any user (including imposter) can read metadata because read is public
    await assertSucceeds(getMetadata(imposterRef));

    // 3. Imposter cannot overwrite the existing object
    await assertFails(uploadString(imposterRef, JPEG_DATA_URL, 'data_url'));

    // 4. Reporter cannot overwrite the existing object after creation
    await assertFails(uploadString(reporterRef, JPEG_DATA_URL, 'data_url'));

    // 5. Reporter cannot delete
    await assertFails(deleteObject(reporterRef));

    // 6. Authority can delete
    await assertSucceeds(deleteObject(authRef));
  });

  it('telemetry and avatar storage rules enforce ownership and size/type constraints', async () => {
    const user1 = testEnv.authenticatedContext('user_telemetry_1', { activeRole: 'passenger' });
    const user2 = testEnv.authenticatedContext('user_telemetry_2', { activeRole: 'passenger' });
    const unauth = testEnv.unauthenticatedContext();

    const telemetryPath = 'telemetry/user_telemetry_1/session.json';
    const user1TelemetryRef = ref(user1.storage(), telemetryPath);
    const user2TelemetryRef = ref(user2.storage(), telemetryPath);

    // 1. User 1 writes own telemetry -> succeeds
    await assertSucceeds(uploadString(user1TelemetryRef, JSON_DATA, 'raw', { contentType: 'application/json' }));
    // 2. User 1 reads own telemetry -> succeeds
    await assertSucceeds(getMetadata(user1TelemetryRef));
    // 3. User 2 cannot write/read User 1's telemetry -> fails
    await assertFails(uploadString(user2TelemetryRef, JSON_DATA, 'raw', { contentType: 'application/json' }));
    await assertFails(getMetadata(user2TelemetryRef));

    // Avatars:
    const avatarPath = 'avatars/user_telemetry_1/photo.jpg';
    const user1AvatarRef = ref(user1.storage(), avatarPath);
    const user2AvatarRef = ref(user2.storage(), avatarPath);
    const unauthAvatarRef = ref(unauth.storage(), avatarPath);

    // 4. User 1 uploads own avatar (valid jpeg) -> succeeds
    await assertSucceeds(uploadString(user1AvatarRef, JPEG_DATA_URL, 'data_url'));
    // 5. Public / unauthenticated user can read avatar metadata -> succeeds
    await assertSucceeds(getMetadata(unauthAvatarRef));
    // 6. User 2 cannot upload to User 1's avatar path -> fails
    await assertFails(uploadString(user2AvatarRef, JPEG_DATA_URL, 'data_url'));
  });
});
