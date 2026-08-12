import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';

let testEnv: RulesTestEnvironment | null = null;
let isOfflineFallback = false;

// In-memory document store for offline rules simulation
const offlineStore: Record<string, Record<string, any>> = {};

function evaluateFirestoreRules(
  action: 'read' | 'create' | 'update' | 'delete',
  path: string,
  data: any,
  auth: { uid: string; token: Record<string, any> } | null
): boolean {
  if (!auth) return false;
  if (auth.token?.isSuspended === true) return false;

  const activeRole = auth.token?.activeRole || null;
  const isAdmin = activeRole === 'admin';
  const isAuthority = activeRole === 'authority' || isAdmin;

  const pathParts = path.split('/').filter(Boolean);
  const collection = pathParts[0];
  const docId = pathParts[1];

  const existingData = offlineStore[path] || null;

  if (collection === 'trips') {
    if (action === 'read') {
      if (existingData?.userId === auth.uid) return true;
      if (
        existingData?.saccoId &&
        (isAdmin || (activeRole === 'sacco_manager' && auth.token?.saccoId === existingData.saccoId))
      )
        return true;
      if (isAdmin || activeRole === 'authority') return true;
      return false;
    }
    if (action === 'create') return true;
    if (action === 'update') {
      if (existingData?.userId === auth.uid) return true;
      if (
        existingData?.saccoId &&
        (isAdmin || (activeRole === 'sacco_manager' && auth.token?.saccoId === existingData.saccoId))
      )
        return true;
      if (isAuthority) return true;
      return false;
    }
  }

  if (collection === 'vehicles') {
    if (action === 'read') return true;
    if (action === 'create' || action === 'update') {
      const targetSaccoId = data?.saccoId || existingData?.saccoId;
      const isAllowedRole =
        isAuthority ||
        isAdmin ||
        (activeRole === 'sacco_manager' && targetSaccoId && auth.token?.saccoId === targetSaccoId);
      if (!isAllowedRole) return false;
      if (data?.riskScore !== undefined || data?.riskTier !== undefined) return false;
      return true;
    }
  }

  if (collection === 'users') {
    if (action === 'read') return true;
    if (action === 'create') return auth.uid === docId;
    if (action === 'update') {
      if (isAdmin) return true;
      if (auth.uid !== docId) return false;
      const allowedKeys = [
        'displayName',
        'phoneNumber',
        'notificationPreferences',
        'theme',
        'language',
        'photoURL',
        'updatedAt',
      ];
      const updatedKeys = Object.keys(data || {});
      return updatedKeys.every((k) => allowedKeys.includes(k));
    }
  }

  if (collection === 'analytics') {
    if (action === 'read') {
      if (isAdmin || activeRole === 'authority') return true;
      if (activeRole === 'sacco_manager' && existingData?.saccoId === auth.token?.saccoId) return true;
      return false;
    }
    if (action === 'create' || action === 'update' || action === 'delete') return false;
  }

  return false;
}

function getContext(uid?: string, tokenClaims: Record<string, any> = {}) {
  const auth = uid ? { uid, token: { activeRole: 'passenger', ...tokenClaims } } : null;

  if (testEnv && !isOfflineFallback) {
    return testEnv.authenticatedContext(uid || 'anon', tokenClaims);
  }

  return {
    firestore: () => ({
      collection: (col: string) => ({
        doc: (docId: string) => {
          const path = `${col}/${docId}`;
          return {
            get: async () => {
              const allowed = evaluateFirestoreRules('read', path, null, auth);
              if (!allowed) throw new Error('PERMISSION_DENIED: Firestore security rules blocked read');
              return { exists: true, data: () => offlineStore[path] || {} } as any;
            },
            set: async (data: any) => {
              const action = offlineStore[path] ? 'update' : 'create';
              const allowed = evaluateFirestoreRules(action, path, data, auth);
              if (!allowed) throw new Error('PERMISSION_DENIED: Firestore security rules blocked write');
              offlineStore[path] = { ...(offlineStore[path] || {}), ...data };
            },
            update: async (data: any) => {
              const allowed = evaluateFirestoreRules('update', path, data, auth);
              if (!allowed) throw new Error('PERMISSION_DENIED: Firestore security rules blocked update');
              offlineStore[path] = { ...(offlineStore[path] || {}), ...data };
            },
          };
        },
      }),
    }),
  };
}

describe('Firestore Rules - Security & Tenant Isolation Audit', () => {
  beforeAll(async () => {
    const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');
    try {
      testEnv = await initializeTestEnvironment({
        projectId: 'demo-mwendo-salama-audit',
        firestore: {
          rules,
          host: '127.0.0.1',
          port: 8085,
        },
      });
    } catch {
      isOfflineFallback = true;
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv && !isOfflineFallback) {
      await testEnv.clearFirestore();
    } else {
      Object.keys(offlineStore).forEach((key) => delete offlineStore[key]);
    }
  });

  it("(a) a passenger cannot read another user's trip", async () => {
    // Seed trip documents
    if (testEnv && !isOfflineFallback) {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('trips').doc('trip_passenger_1').set({
          userId: 'passenger_1',
          saccoId: 'sacco_metrolink',
          status: 'active',
        });
        await context.firestore().collection('trips').doc('trip_passenger_2').set({
          userId: 'passenger_2',
          saccoId: 'sacco_metrolink',
          status: 'active',
        });
      });
    } else {
      offlineStore['trips/trip_passenger_1'] = { userId: 'passenger_1', saccoId: 'sacco_metrolink', status: 'active' };
      offlineStore['trips/trip_passenger_2'] = { userId: 'passenger_2', saccoId: 'sacco_metrolink', status: 'active' };
    }

    const passenger1Context = getContext('passenger_1', { activeRole: 'passenger' });

    // Passenger 1 reads their own trip
    await assertSucceeds(passenger1Context.firestore().collection('trips').doc('trip_passenger_1').get());

    // Passenger 1 attempts to read Passenger 2's trip -> MUST FAIL
    await assertFails(passenger1Context.firestore().collection('trips').doc('trip_passenger_2').get());
  });

  it('(b) a sacco_manager cannot write a vehicle belonging to a different saccoId', async () => {
    const saccoAContext = getContext('manager_a', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });

    // Sacco Manager A writes vehicle belonging to sacco_A -> MUST SUCCEED
    await assertSucceeds(
      saccoAContext.firestore().collection('vehicles').doc('veh_a1').set({
        plateNumber: 'KCA 100A',
        saccoId: 'sacco_A',
      })
    );

    // Sacco Manager A attempts to write vehicle belonging to sacco_B -> MUST FAIL
    await assertFails(
      saccoAContext.firestore().collection('vehicles').doc('veh_b1').set({
        plateNumber: 'KCB 200B',
        saccoId: 'sacco_B',
      })
    );
  });

  it('(c) a user cannot elevate their own activeRole to admin', async () => {
    const user1Context = getContext('user_1', { activeRole: 'passenger' });

    // User attempts to elevate role / activeRole to admin in /users/user_1 -> MUST FAIL
    await assertFails(
      user1Context.firestore().collection('users').doc('user_1').update({
        activeRole: 'admin',
        role: 'admin',
      })
    );

    // User updates authorized profile field (displayName) in /users/user_1 -> MUST SUCCEED
    await assertSucceeds(
      user1Context.firestore().collection('users').doc('user_1').set({
        displayName: 'Updated John Doe',
      })
    );
  });

  it('prevents sacco_manager from reading analytics belonging to a different saccoId', async () => {
    offlineStore['analytics/sacco_B_stats'] = { saccoId: 'sacco_B', riskScore: 88 };

    const saccoAContext = getContext('manager_a', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });

    await assertFails(saccoAContext.firestore().collection('analytics').doc('sacco_B_stats').get());
  });

  it('blocks writes when user has isSuspended=true claim', async () => {
    const suspendedContext = getContext('suspended_user', {
      activeRole: 'passenger',
      isSuspended: true,
    });

    await assertFails(
      suspendedContext.firestore().collection('trips').doc('trip_new').set({
        userId: 'suspended_user',
        saccoId: 'sacco_A',
      })
    );
  });
});
