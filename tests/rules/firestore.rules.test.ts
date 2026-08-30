import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-mwendo-salama-rules';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

let testEnv: RulesTestEnvironment;

function claims(activeRole: string, saccoId?: string) {
  return {
    activeRole,
    firebase: { sign_in_provider: 'custom' },
    ...(saccoId ? { saccoId } : {}),
  };
}

function authedDb(uid: string, activeRole: string, saccoId?: string) {
  return testEnv.authenticatedContext(uid, claims(activeRole, saccoId)).firestore();
}

function emulatorEndpoint(value: string, fallbackPort: number) {
  const [host, port] = value.split(':');
  return { host, port: Number(port ?? fallbackPort) };
}

beforeAll(async () => {
  const firestore = emulatorEndpoint(FIRESTORE_EMULATOR_HOST, 8080);
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: firestore.host,
      port: firestore.port,
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore security rules', () => {
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
});
