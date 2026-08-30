import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-mwendo-salama-rules';
const FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
let testEnv: RulesTestEnvironment;

function dbFor(uid: string, saccoId = 'sacco-a') {
  return testEnv.authenticatedContext(uid, {
    activeRole: 'sacco_manager',
    saccoId,
    firebase: { sign_in_provider: 'custom' },
  }).firestore();
}

function endpoint(value: string) {
  const [host, port] = value.split(':');
  return { host, port: Number(port ?? 8080) };
}

beforeAll(async () => {
  const firestore = endpoint(FIRESTORE_EMULATOR_HOST);
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: firestore.host,
      port: firestore.port,
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

afterEach(() => testEnv.clearFirestore());
afterAll(() => testEnv.cleanup());

describe('SACCO vehicle and driver ownership rules', () => {
  it('allows a manager to update permitted vehicle operations without changing SACCO', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('vehicles/v1').set({
        saccoId: 'sacco-a', saccoName: 'A', regNumber: 'KAA 111A', capacity: 33,
        status: 'active', insuranceExpiry: '2027-01-01', inspectionExpiry: '2027-01-01',
      });
    });
    await assertSucceeds(updateDoc(doc(dbFor('manager-a'), 'vehicles/v1'), { status: 'maintenance', capacity: 35 }));
  });

  it('blocks a manager from changing vehicle SACCO ownership', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('vehicles/v1').set({
        saccoId: 'sacco-a', saccoName: 'A', regNumber: 'KAA 111A', capacity: 33,
        status: 'active', insuranceExpiry: '2027-01-01', inspectionExpiry: '2027-01-01',
      });
    });
    await assertFails(updateDoc(doc(dbFor('manager-a'), 'vehicles/v1'), { saccoId: 'sacco-b' }));
  });

  it('blocks a manager from changing protected vehicle risk fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('vehicles/v1').set({
        saccoId: 'sacco-a', saccoName: 'A', regNumber: 'KAA 111A', capacity: 33,
        status: 'active', insuranceExpiry: '2027-01-01', inspectionExpiry: '2027-01-01', riskScore: 20, riskTier: 'low',
      });
    });
    await assertFails(updateDoc(doc(dbFor('manager-a'), 'vehicles/v1'), { riskScore: 1 }));
  });

  it('blocks a manager from changing driver SACCO ownership', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('drivers/d1').set({
        name: 'Driver', licenseNumber: 'DL-1', saccoId: 'sacco-a', status: 'active', safetyScore: 80,
      });
    });
    await assertFails(updateDoc(doc(dbFor('manager-a'), 'drivers/d1'), { saccoId: 'sacco-b' }));
  });

  it('allows a manager to update driver operational fields within their SACCO', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('drivers/d1').set({
        name: 'Driver', licenseNumber: 'DL-1', saccoId: 'sacco-a', status: 'active', safetyScore: 80,
      });
    });
    await assertSucceeds(updateDoc(doc(dbFor('manager-a'), 'drivers/d1'), { status: 'on_leave', phone: '+254700000000' }));
  });
});
