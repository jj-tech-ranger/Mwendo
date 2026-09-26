// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-mwendo-salama-rules';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

let testEnv: RulesTestEnvironment | null = null;
let emulatorOnline = false;

function claims(activeRole: string, saccoId?: string, mfaVerifiedAt?: number) {
  return {
    activeRole,
    firebase: { sign_in_provider: 'custom' },
    ...(saccoId ? { saccoId } : {}),
    ...(typeof mfaVerifiedAt === 'number' ? { mfaVerifiedAt } : {}),
  };
}

function authedDb(uid: string, activeRole: string, saccoId?: string, mfaVerifiedAt?: number) {
  if (!testEnv) throw new Error('RulesTestEnvironment not initialized');
  return testEnv.authenticatedContext(uid, claims(activeRole, saccoId, mfaVerifiedAt)).firestore();
}

function emulatorEndpoint(value: string, fallbackPort: number) {
  const [host, port] = value.split(':');
  return { host, port: Number(port ?? fallbackPort) };
}

beforeAll(async () => {
  const firestore = emulatorEndpoint(FIRESTORE_EMULATOR_HOST, 8080);
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
  } catch (err: any) {
    const isOfflineOrNginx =
      typeof err?.message === 'string' &&
      (err.message.includes('405') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('Not Allowed'));
    if (isOfflineOrNginx) {
      console.info(
        `[firestore.rules.test] Firestore emulator not active on ${firestore.host}:${firestore.port} (requires 'firebase emulators:exec' with JRE). Rules tests skipped gracefully.`
      );
    } else {
      console.warn('[firestore.rules.test] Failed to initialize Firestore test environment:', err);
    }
  }
});

afterEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe('Firestore security rules', () => {
  beforeEach((ctx) => {
    if (!emulatorOnline || !testEnv) {
      ctx.skip();
    }
  });
  it('denies unauthenticated reads and writes', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const ref = doc(db, 'users/passenger-1');

    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { displayName: 'Attacker' }));
  });

  it('allows a passenger to create their own valid user document', async () => {
    const db = authedDb('passenger-1', 'passenger');

    await assertSucceeds(setDoc(doc(db, 'users/passenger-1'), {
      displayName: 'Passenger',
      role: 'passenger',
      activeRole: 'passenger',
      roles: ['passenger'],
    }));
  });

  it('denies a passenger access to another passenger user document', async () => {
    const db = authedDb('passenger-1', 'passenger');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/passenger-2'), {
        displayName: 'Other Passenger',
        role: 'passenger',
        activeRole: 'passenger',
        roles: ['passenger'],
      });
    });

    await assertFails(getDoc(doc(db, 'users/passenger-2')));
  });

  it('denies cross-SACCO vehicle reads to SACCO managers', async () => {
    const db = authedDb('manager-a', 'sacco_manager', 'sacco-a');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles/vehicle-b'), {
        saccoId: 'sacco-b',
        registration: 'KXX 123X',
      });
    });

    await assertFails(getDoc(doc(db, 'vehicles/vehicle-b')));
  });

  it('denies passengers direct read access to full /vehicles documents containing operational secrets', async () => {
    const db = authedDb('passenger-1', 'passenger');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles/KDA123A'), {
        id: 'KDA123A',
        regNumber: 'KDA 123A',
        saccoId: 'sacco-a',
        saccoName: 'Metro SACCO',
        capacity: 33,
        status: 'active',
        insuranceExpiry: '2027-12-31',
        inspectionExpiry: '2027-12-31',
        riskScore: 35,
        riskTier: 'low',
      });
    });

    // Passenger MUST be denied direct read of full vehicle doc
    await assertFails(getDoc(doc(db, 'vehicles/KDA123A')));
  });

  it('allows signed-in passengers read access to /vehicle_public_summary safe projections', async () => {
    const db = authedDb('passenger-1', 'passenger');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicle_public_summary/KDA123A'), {
        id: 'KDA123A',
        vehicleId: 'KDA123A',
        regNumber: 'KDA 123A',
        saccoId: 'sacco-a',
        saccoName: 'Metro SACCO',
        riskTier: 'low',
        riskScore: 35,
        isProvisional: false,
        status: 'active',
      });
    });

    // Signed-in passenger can safely read public standing summary
    await assertSucceeds(getDoc(doc(db, 'vehicle_public_summary/KDA123A')));
  });

  it('denies unauthenticated users read access to /vehicle_public_summary', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicle_public_summary/KDA123A'), {
        id: 'KDA123A',
        regNumber: 'KDA 123A',
        saccoId: 'sacco-a',
        saccoName: 'Metro SACCO',
        riskTier: 'low',
      });
    });

    await assertFails(getDoc(doc(unauthedDb, 'vehicle_public_summary/KDA123A')));
  });

  it('denies passengers write access to /vehicle_public_summary', async () => {
    const db = authedDb('passenger-1', 'passenger');
    await assertFails(setDoc(doc(db, 'vehicle_public_summary/KDA123A'), {
      regNumber: 'KDA 123A',
      saccoId: 'sacco-a',
      riskTier: 'low',
    }));
  });

  it('allows authority to write and update /vehicle_public_summary', async () => {
    const db = authedDb('authority-1', 'authority');
    await assertSucceeds(setDoc(doc(db, 'vehicle_public_summary/KDA123A'), {
      id: 'KDA123A',
      regNumber: 'KDA 123A',
      saccoId: 'sacco-a',
      saccoName: 'Metro SACCO',
      riskTier: 'low',
      riskScore: 30,
      isProvisional: false,
      status: 'active',
    }));
  });

  it('denies a SACCO manager from moving a vehicle into another SACCO', async () => {
    const db = authedDb('manager-a', 'sacco_manager', 'sacco-a');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles/vehicle-a'), {
        saccoId: 'sacco-a',
        registration: 'KAA 111A',
      });
    });

    await assertFails(setDoc(doc(db, 'vehicles/vehicle-a'), {
      saccoId: 'sacco-b',
      registration: 'KAA 111A',
    }));
  });

  it('denies cross-SACCO complaint reads and mutations', async () => {
    const db = authedDb('manager-a', 'sacco_manager', 'sacco-a');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'complaints/complaint-b'), {
        reportedByUid: 'passenger-b',
        saccoId: 'sacco-b',
        status: 'open',
      });
    });

    await assertFails(getDoc(doc(db, 'complaints/complaint-b')));
    await assertFails(updateDoc(doc(db, 'complaints/complaint-b'), { status: 'resolved' }));
  });

  it('denies cross-SACCO violation reads and mutations', async () => {
    const db = authedDb('manager-a', 'sacco_manager', 'sacco-a');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'violations/violation-b'), {
        userId: 'driver-b',
        saccoId: 'sacco-b',
        status: 'open',
      });
    });

    await assertFails(getDoc(doc(db, 'violations/violation-b')));
    await assertFails(updateDoc(doc(db, 'violations/violation-b'), { status: 'disputed' }));
  });

  it('denies cross-SACCO safety-alert reads and mutations', async () => {
    const db = authedDb('manager-a', 'sacco_manager', 'sacco-a');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'safety_alerts/alert-b'), {
        userId: 'passenger-b',
        saccoId: 'sacco-b',
        status: 'open',
      });
    });

    await assertFails(getDoc(doc(db, 'safety_alerts/alert-b')));
    await assertFails(updateDoc(doc(db, 'safety_alerts/alert-b'), { status: 'acknowledged' }));
  });

  it('denies reads from unregistered alerts collection for all users including authority (reproducing fail-closed permission-denied)', async () => {
    const db = authedDb('authority-1', 'authority');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'alerts/legacy-alert-1'), {
        status: 'active',
        message: 'Emergency SOS in alerts collection',
      });
    });

    // Both single doc read and collection query fail with PERMISSION_DENIED under firestore.rules
    await assertFails(getDoc(doc(db, 'alerts/legacy-alert-1')));
    await assertFails(getDocs(query(collection(db, 'alerts'))));
  });

  it('allows authenticated authority user to query real-time safety_alerts with active status filter and recency ordering', async () => {
    const db = authedDb('authority-1', 'authority');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const fs = ctx.firestore();
      await setDoc(doc(fs, 'safety_alerts/alert-active-1'), {
        userId: 'passenger-1',
        saccoId: 'sacco-a',
        status: 'active',
        type: 'sos',
        severity: 'critical',
        message: 'Accident reported on Thika Road',
        timestamp: '2026-09-12T10:00:00Z',
      });
      await setDoc(doc(fs, 'safety_alerts/alert-resolved-1'), {
        userId: 'passenger-2',
        saccoId: 'sacco-b',
        status: 'resolved',
        type: 'sos',
        severity: 'critical',
        message: 'Resolved incident on Mombasa Road',
        timestamp: '2026-09-12T09:00:00Z',
      });
    });

    const activeQuery = query(
      collection(db, 'safety_alerts'),
      where('status', '==', 'active'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const snapshot = await assertSucceeds(getDocs(activeQuery));
    expect(snapshot.docs.length).toBe(1);
    expect(snapshot.docs[0].id).toBe('alert-active-1');
    expect(snapshot.docs[0].data().status).toBe('active');

    // Authority can acknowledge / resolve active alert
    await assertSucceeds(
      updateDoc(doc(db, 'safety_alerts/alert-active-1'), {
        status: 'resolved',
        acknowledgedByAuthority: true,
        resolvedAt: new Date().toISOString(),
      })
    );
  });

  it('denies clients from modifying an existing trip', async () => {
    const db = authedDb('passenger-1', 'passenger', 'sacco-a');
    const tripRef = doc(db, 'trips/trip-1');

    await assertSucceeds(setDoc(tripRef, {
      userId: 'passenger-1',
      saccoId: 'sacco-a',
      status: 'completed',
      maxSpeedKmH: 70,
    }));

    await assertFails(updateDoc(tripRef, {
      maxSpeedKmH: 150,
    }));
  });

  it('rejects a trip with impossible GPS coordinates', async () => {
    const db = authedDb('passenger-1', 'passenger');

    await assertFails(setDoc(doc(db, 'trips/trip-invalid-gps'), {
      userId: 'passenger-1',
      latitude: 91,
      longitude: 36,
    }));
  });

  it('rejects a trip with an impossible speed', async () => {
    const db = authedDb('passenger-1', 'passenger');

    await assertFails(setDoc(doc(db, 'trips/trip-invalid-speed'), {
      userId: 'passenger-1',
      currentSpeedKmH: 181,
    }));
  });

  it('allows creating trip without matching vehicleId when vehicleVerified is false (Phase 6 / BUG-005)', async () => {
    const db = authedDb('passenger-1', 'passenger');

    await assertSucceeds(setDoc(doc(db, 'trips/trip-unverified-valid'), {
      userId: 'passenger-1',
      saccoId: 'sacco-a',
      vehicleRegNumber: 'KZZ999X',
      vehicleVerified: false,
      maxSpeedKmH: 60,
    }));
  });

  it('rejects creating trip without matching vehicleId when vehicleVerified is claimed true (server-side data validation)', async () => {
    const db = authedDb('passenger-1', 'passenger');

    await assertFails(setDoc(doc(db, 'trips/trip-unverified-fraudulent'), {
      userId: 'passenger-1',
      saccoId: 'sacco-a',
      vehicleRegNumber: 'KZZ999X',
      vehicleVerified: true,
      maxSpeedKmH: 60,
    }));
  });

  it('allows creating trip with verified vehicle reference when vehicleVerified is true', async () => {
    const db = authedDb('passenger-1', 'passenger');

    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles/veh-verified-phase6'), {
        saccoId: 'sacco-a',
        regNumber: 'KDA 123A',
        status: 'active',
      });
    });

    await assertSucceeds(setDoc(doc(db, 'trips/trip-verified-valid'), {
      userId: 'passenger-1',
      vehicleId: 'veh-verified-phase6',
      saccoId: 'sacco-a',
      vehicleRegNumber: 'KDA 123A',
      vehicleVerified: true,
      maxSpeedKmH: 60,
    }));
  });

  it('rejects creating trip with verified vehicle reference when vehicleVerified is false', async () => {
    const db = authedDb('passenger-1', 'passenger');

    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles/veh-verified-phase6'), {
        saccoId: 'sacco-a',
        regNumber: 'KDA 123A',
        status: 'active',
      });
    });

    await assertFails(setDoc(doc(db, 'trips/trip-verified-mismatched'), {
      userId: 'passenger-1',
      vehicleId: 'veh-verified-phase6',
      saccoId: 'sacco-a',
      vehicleRegNumber: 'KDA 123A',
      vehicleVerified: false,
      maxSpeedKmH: 60,
    }));
  });

  it('allows registered user to submit black spot confirmation under their own UID', async () => {
    const db = authedDb('passenger-1', 'passenger');
    const confRef = doc(db, 'black_spots/spot-1/confirmations/passenger-1');

    await assertSucceeds(setDoc(confRef, {
      userId: 'passenger-1',
      type: 'still_there',
      timestamp: new Date(),
    }));
  });

  it('denies user submitting a black spot confirmation under someone else UID', async () => {
    const db = authedDb('passenger-1', 'passenger');
    const confRef = doc(db, 'black_spots/spot-1/confirmations/passenger-2');

    await assertFails(setDoc(confRef, {
      userId: 'passenger-2',
      type: 'still_there',
      timestamp: new Date(),
    }));
  });

  it('denies updating a confirmation within 24 hours (rate-limit)', async () => {
    const db = authedDb('passenger-1', 'passenger');
    const confRef = doc(db, 'black_spots/spot-1/confirmations/passenger-1');

    await assertSucceeds(setDoc(confRef, {
      userId: 'passenger-1',
      type: 'still_there',
      timestamp: new Date(),
    }));

    // Trying to update immediately should fail 24h rule
    await assertFails(updateDoc(confRef, {
      type: 'resolved',
    }));
  });

  it('SEC-MFA: denies admin deleting a vehicle when MFA is not verified', async () => {
    const db = authedDb('admin-no-mfa', 'admin');
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles/KAA111A'), {
        saccoId: 'sacco-a',
        regNumber: 'KAA 111A',
        status: 'active',
      });
    });

    await assertFails(deleteDoc(doc(db, 'vehicles/KAA111A')));
  });

  it('SEC-MFA: allows admin deleting a vehicle when MFA is verified within 12 hours', async () => {
    const freshMfaTime = Date.now();
    const db = authedDb('admin-mfa', 'admin', undefined, freshMfaTime);
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles/KAA111B'), {
        saccoId: 'sacco-a',
        regNumber: 'KAA 111B',
        status: 'active',
      });
    });

    await assertSucceeds(deleteDoc(doc(db, 'vehicles/KAA111B')));
  });

  it('SEC-MFA: denies admin deleting a vehicle when MFA verification has expired (>12 hours)', async () => {
    const expiredMfaTime = Date.now() - 13 * 60 * 60 * 1000;
    const db = authedDb('admin-expired-mfa', 'admin', undefined, expiredMfaTime);
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles/KAA111C'), {
        saccoId: 'sacco-a',
        regNumber: 'KAA 111C',
        status: 'active',
      });
    });

    await assertFails(deleteDoc(doc(db, 'vehicles/KAA111C')));
  });

  it('SEC-MFA: denies admin deleting a user when not MFA-verified', async () => {
    const db = authedDb('admin-no-mfa', 'admin');
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/user-to-del'), {
        displayName: 'Target User',
        role: 'passenger',
      });
    });

    await assertFails(deleteDoc(doc(db, 'users/user-to-del')));
  });

  it('SEC-MFA: allows admin deleting a user when MFA is verified within 12 hours', async () => {
    const freshMfaTime = Date.now();
    const db = authedDb('admin-mfa', 'admin', undefined, freshMfaTime);
    await testEnv!.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/user-to-del-2'), {
        displayName: 'Target User 2',
        role: 'passenger',
      });
    });

    await assertSucceeds(deleteDoc(doc(db, 'users/user-to-del-2')));
  });

  describe('FCM Device Token Access Boundary & Security Hardening (§27)', () => {
    it('allows a user to update their own fcmToken on users/{userId}', async () => {
      const db = authedDb('passenger-fcm-1', 'passenger');
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/passenger-fcm-1'), {
          displayName: 'Passenger FCM',
          role: 'passenger',
          activeRole: 'passenger',
          roles: ['passenger'],
          updatedAt: new Date().toISOString(),
        });
      });

      await assertSucceeds(
        updateDoc(doc(db, 'users/passenger-fcm-1'), {
          fcmToken: 'valid_sample_fcm_token_string_12345',
          updatedAt: new Date().toISOString(),
        })
      );
    });

    it('allows a user to read and write to their own /users/{userId}/fcm_tokens/{tokenId}', async () => {
      const db = authedDb('passenger-fcm-1', 'passenger');
      const tokenRef = doc(db, 'users/passenger-fcm-1/fcm_tokens/token-doc-1');

      await assertSucceeds(
        setDoc(tokenRef, {
          id: 'token-doc-1',
          token: 'device_registration_token_1234567890',
          platform: 'web',
          userId: 'passenger-fcm-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        })
      );

      await assertSucceeds(getDoc(tokenRef));
      await assertSucceeds(deleteDoc(tokenRef));
    });

    it('denies other passengers access to a user private fcm_tokens subcollection', async () => {
      const attackerDb = authedDb('attacker-passenger', 'passenger');
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/victim-user/fcm_tokens/victim-token'), {
          id: 'victim-token',
          token: 'private_victim_device_token',
          platform: 'web',
          userId: 'victim-user',
        });
      });

      await assertFails(getDoc(doc(attackerDb, 'users/victim-user/fcm_tokens/victim-token')));
      await assertFails(
        setDoc(doc(attackerDb, 'users/victim-user/fcm_tokens/victim-token'), {
          token: 'malicious_overwrite_token',
        })
      );
    });

    it('denies SACCO managers and authorities read/write access to user private fcm_tokens', async () => {
      const managerDb = authedDb('sacco-mgr-1', 'sacco_manager', 'sacco-a');
      const authorityDb = authedDb('authority-officer-1', 'authority');

      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/sacco-commuter-1'), {
          displayName: 'Sacco Commuter',
          saccoId: 'sacco-a',
          role: 'passenger',
          activeRole: 'passenger',
          roles: ['passenger'],
        });
        await setDoc(doc(ctx.firestore(), 'users/sacco-commuter-1/fcm_tokens/commuter-token'), {
          id: 'commuter-token',
          token: 'commuter_private_fcm_token',
          userId: 'sacco-commuter-1',
        });
      });

      // SACCO Manager cannot read or write commuter's FCM tokens
      await assertFails(getDoc(doc(managerDb, 'users/sacco-commuter-1/fcm_tokens/commuter-token')));
      await assertFails(deleteDoc(doc(managerDb, 'users/sacco-commuter-1/fcm_tokens/commuter-token')));

      // Authority officer cannot read or write user's FCM tokens
      await assertFails(getDoc(doc(authorityDb, 'users/sacco-commuter-1/fcm_tokens/commuter-token')));
      await assertFails(deleteDoc(doc(authorityDb, 'users/sacco-commuter-1/fcm_tokens/commuter-token')));
    });

    it('denies unauthenticated access to /users/{userId}/fcm_tokens', async () => {
      const unauthDb = testEnv!.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, 'users/any-user/fcm_tokens/any-token')));
      await assertFails(
        setDoc(doc(unauthDb, 'users/any-user/fcm_tokens/any-token'), {
          token: 'unauthenticated_token',
        })
      );
    });

    it('allows admin to read and delete user device tokens for administrative moderation', async () => {
      const adminDb = authedDb('platform-admin', 'admin');
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users/user-audit-1/fcm_tokens/token-audit'), {
          id: 'token-audit',
          token: 'admin_managed_device_token',
          userId: 'user-audit-1',
        });
      });

      await assertSucceeds(getDoc(doc(adminDb, 'users/user-audit-1/fcm_tokens/token-audit')));
      await assertSucceeds(deleteDoc(doc(adminDb, 'users/user-audit-1/fcm_tokens/token-audit')));
    });
  });
});
