import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  cleanup,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-mwendo-salama-rules';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';

let testEnv: RulesTestEnvironment;

function claims(activeRole: string, saccoId?: string) {
  return {
    activeRole,
    ...(saccoId ? { saccoId } : {}),
  };
}

function authedDb(uid: string, activeRole: string, saccoId?: string) {
  return testEnv.authenticatedContext(uid, claims(activeRole, saccoId)).firestore();
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: FIRESTORE_EMULATOR_HOST.split(':')[0],
      port: Number(FIRESTORE_EMULATOR_HOST.split(':')[1] ?? 8080),
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await cleanup();
});

describe('Firestore security rules', () => {
  it('denies unauthenticated reads and writes', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    const ref = doc(db, 'users/passenger-1');

    await assertFails(getDoc(ref));
    await assertFails(setDoc(ref, { displayName: 'Attacker' }));
  });

  it('allows a passenger to create their own user document when permitted by the rules', async () => {
    const db = authedDb('passenger-1', 'passenger');
    await assertSucceeds(setDoc(doc(db, 'users/passenger-1'), {
      displayName: 'Passenger',
      role: 'passenger',
    }));
  });

  it('denies a passenger access to another passenger user document', async () => {
    const db = authedDb('passenger-1', 'passenger');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/passenger-2'), {
        displayName: 'Other Passenger',
        role: 'passenger',
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

  it('denies clients from modifying an existing trip', async () => {
    const db = authedDb('passenger-1', 'passenger');
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'trips/trip-1'), {
        userId: 'passenger-1',
        status: 'completed',
        maxSpeed: 70,
      });
    });

    await assertFails(setDoc(doc(db, 'trips/trip-1'), {
      userId: 'passenger-1',
      status: 'completed',
      maxSpeed: 150,
    }));
  });
});
