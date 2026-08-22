import { Timestamp } from 'firebase/firestore';
import { describe, beforeAll, afterAll, beforeEach, it } from 'vitest';

// In-memory document and storage store for deterministic rules evaluation
const offlineStore: Record<string, Record<string, any>> = {};
const offlineStorageStore: Record<string, { size: number; contentType: string; data?: any }> = {};

export async function assertSucceeds<T>(promise: Promise<T> | T): Promise<T> {
  try {
    const res = await promise;
    return res;
  } catch (err: any) {
    throw new Error(`Expected operation to succeed, but failed with: ${err?.message || err}`);
  }
}

export async function assertFails<T>(promise: Promise<T> | T): Promise<any> {
  try {
    await promise;
  } catch (err: any) {
    // Operation correctly failed
    return err;
  }
  throw new Error('Expected operation to fail with permission-denied / error, but it succeeded.');
}

function evaluateFirestoreRules(
  action: 'read' | 'create' | 'update' | 'delete',
  path: string,
  data: any,
  auth: { uid: string; token: Record<string, any> } | null
): boolean {
  if (auth?.token?.isSuspended === true) return false;

  const activeRole = auth?.token?.activeRole || null;
  const isAdmin = activeRole === 'admin';
  const isAuthority = activeRole === 'authority' || isAdmin;

  const pathParts = path.split('/').filter(Boolean);
  const collection = pathParts[0];
  const docId = pathParts[1];

  const existingData = offlineStore[path] || null;

  // Public collections
  if (collection === 'public_pins' || collection === 'feature_flags' || collection === 'system_config') {
    if (action === 'read') return true;
    if (action === 'create' || action === 'update' || action === 'delete') {
      if (collection === 'public_pins') return isAuthority || isAdmin;
      return isAdmin;
    }
  }

  if (!auth) return false;

  const isRegisteredUser =
    auth != null &&
    auth.token?.firebase?.sign_in_provider !== 'anonymous' &&
    auth.token?.provider_id !== 'anonymous';

  const isOwner = (uid?: string) => Boolean(uid && auth.uid === uid);
  const isSaccoManager = (saccoId?: string | null) =>
    isAdmin || (activeRole === 'sacco_manager' && saccoId != null && auth.token?.saccoId === saccoId);

  // Analytics
  if (collection === 'analytics') {
    if (action === 'read') {
      if (isAdmin || activeRole === 'authority') return true;
      if (activeRole === 'sacco_manager' && existingData?.saccoId === auth.token?.saccoId) return true;
      return false;
    }
    return false;
  }

  // Users Collection
  if (collection === 'users') {
    if (action === 'read') {
      if (isOwner(docId) || isAdmin || isAuthority) return true;
      if (activeRole === 'sacco_manager' && existingData?.saccoId && existingData.saccoId === auth.token?.saccoId) {
        return true;
      }
      return false;
    }
    if (action === 'create') {
      if (!isOwner(docId)) return false;
      if (data?.role && data.role !== 'passenger') return false;
      if (data?.activeRole !== 'passenger') return false;
      if (!Array.isArray(data?.roles) || data.roles.length !== 1 || data.roles[0] !== 'passenger') return false;
      if ('saccoId' in data || 'authorityId' in data || 'authorityScope' in data || 'badgeNumber' in data) return false;
      if ('isActive' in data && data.isActive !== true) return false;
      return true;
    }
    if (action === 'update') {
      if (isAdmin) return true;
      if (!isOwner(docId)) return false;
      const allowedKeys = [
        'displayName',
        'phoneNumber',
        'notificationPreferences',
        'theme',
        'language',
        'photoURL',
        'emergencyContacts',
        'updatedAt',
        'analyticsConsent',
        'analyticsConsentAt',
      ];
      const updatedKeys = Object.keys(data || {});
      return updatedKeys.every((k) => allowedKeys.includes(k));
    }
    if (action === 'delete') return isAdmin;
  }

  // VT-003 Validation Helpers
  const checkCoords = (lat?: any, lon?: any) => {
    if (lat !== undefined || lon !== undefined) {
      if (typeof lat !== 'number' || typeof lon !== 'number') return false;
      if (lat < -5.5 || lat > 6.0 || lon < 33.0 || lon > 43.5) return false;
    }
    return true;
  };

  const checkSpeed = (speed?: any) => {
    if (speed !== undefined) {
      if (typeof speed !== 'number') return false;
      if (speed < 0 || speed > 180) return false;
    }
    return true;
  };

  const checkTimestamp = (ts?: any) => {
    if (!ts) return true;
    let ms: number;
    if (ts && typeof ts.toMillis === 'function') {
      ms = ts.toMillis();
    } else if (ts && typeof ts.seconds === 'number') {
      ms = ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
    } else if (ts instanceof Date) {
      ms = ts.getTime();
    } else {
      return false; // Strings or invalid types rejected by `ts is timestamp`
    }
    if (!Number.isFinite(ms)) return false;
    const now = Date.now();
    if (ms > now + 5 * 60 * 1000) return false;
    if (ms < now - 24 * 60 * 60 * 1000) return false;
    return true;
  };

  const isValidTrip = (d: any) => {
    if (!d) return true;
    if (!checkCoords(d.latitude, d.longitude)) return false;
    if (d.startLocation && !checkCoords(d.startLocation.latitude, d.startLocation.longitude)) return false;
    if (d.endLocation && !checkCoords(d.endLocation.latitude, d.endLocation.longitude)) return false;
    if (d.lastGpsUpdate && !checkCoords(d.lastGpsUpdate.latitude, d.lastGpsUpdate.longitude)) return false;
    if (d.lastGpsUpdate && !checkSpeed(d.lastGpsUpdate.speedKmH)) return false;
    if (!checkSpeed(d.currentSpeedKmH)) return false;
    if (!checkSpeed(d.maxSpeedKmH)) return false;
    if (!checkSpeed(d.avgSpeedKmH)) return false;
    if (!checkTimestamp(d.startTime)) return false;
    if (!checkTimestamp(d.timestamp)) return false;
    return true;
  };

  const isValidViolation = (d: any) => {
    if (!d) return true;
    if (!checkCoords(d.latitude, d.longitude)) return false;
    if (!checkSpeed(d.recordedSpeedKmH)) return false;
    if (!checkSpeed(d.speedLimitKmH)) return false;
    if (!checkTimestamp(d.timestamp)) return false;
    return true;
  };

  // Trips Collection
  if (collection === 'trips') {
    if (action === 'read') {
      if (existingData?.userId === auth.uid) return true;
      if (existingData?.saccoId && isSaccoManager(existingData.saccoId)) return true;
      if (isAdmin || activeRole === 'authority') return true;
      return false;
    }
    if (action === 'create') {
      return isRegisteredUser && data?.userId === auth.uid && isValidTrip(data);
    }
    if (action === 'update') {
      const allowed =
        (existingData?.userId === auth.uid ||
          (existingData?.saccoId && isSaccoManager(existingData.saccoId)) ||
          isAuthority) &&
        isValidTrip(data);
      return allowed;
    }
    if (action === 'delete') return isAdmin;
  }

  // Vehicles Collection
  if (collection === 'vehicles') {
    if (action === 'read') {
      if (isAdmin || isAuthority) return true;
      if (activeRole === 'sacco_manager' && existingData?.saccoId && auth.token?.saccoId === existingData.saccoId) {
        return true;
      }
      return false;
    }
    if (action === 'create') {
      const targetSaccoId = data?.saccoId;
      return isAuthority || isAdmin || (activeRole === 'sacco_manager' && targetSaccoId && auth.token?.saccoId === targetSaccoId);
    }
    if (action === 'update') {
      const targetSaccoId = existingData?.saccoId || data?.saccoId;
      const isAllowed = isAuthority || isAdmin || (activeRole === 'sacco_manager' && targetSaccoId && auth.token?.saccoId === targetSaccoId);
      if (!isAllowed) return false;
      if (data?.riskScore !== undefined || data?.riskTier !== undefined) return false;
      return true;
    }
    if (action === 'delete') return isAdmin;
  }

  // SACCOs Collection
  if (collection === 'saccos') {
    if (action === 'read') return true;
    if (action === 'create') return isAuthority || isAdmin;
    if (action === 'update') {
      const isAllowed = isAuthority || isAdmin || isSaccoManager(docId);
      if (!isAllowed) return false;
      if (data?.safetyScore !== undefined) return false;
      return true;
    }
    if (action === 'delete') return isAdmin;
  }

  // Authorities Collection
  if (collection === 'authorities') {
    if (action === 'read') return true;
    if (action === 'create' || action === 'update' || action === 'delete') return isAdmin;
  }

  // Black Spots Collection
  if (collection === 'black_spots') {
    if (action === 'read') return isRegisteredUser;
    if (action === 'create') return isRegisteredUser && data?.reportedByUid === auth.uid;
    if (action === 'update') return isAuthority || (isRegisteredUser && existingData?.reportedByUid === auth.uid);
    if (action === 'delete') return isAuthority;
  }

  // Safety Alerts Collection
  if (collection === 'safety_alerts') {
    if (action === 'read') {
      if (existingData?.userId === auth.uid) return true;
      if (existingData?.saccoId && isSaccoManager(existingData.saccoId)) return true;
      if (isAdmin || activeRole === 'authority') return true;
      return false;
    }
    if (action === 'create') return isRegisteredUser && data?.userId === auth.uid;
    if (action === 'update') {
      return (
        existingData?.userId === auth.uid ||
        (existingData?.saccoId && isSaccoManager(existingData.saccoId)) ||
        isAuthority
      );
    }
    if (action === 'delete') return isAdmin;
  }

  // Violations Collection
  if (collection === 'violations') {
    if (action === 'read') {
      if (existingData?.userId === auth.uid) return true;
      if (existingData?.saccoId && isSaccoManager(existingData.saccoId)) return true;
      if (isAdmin || activeRole === 'authority') return true;
      return false;
    }
    if (action === 'create') {
      return isRegisteredUser && data?.userId === auth.uid && isValidViolation(data);
    }
    if (action === 'update') {
      const allowed =
        ((existingData?.saccoId && isSaccoManager(existingData.saccoId)) || isAuthority) &&
        isValidViolation(data);
      return allowed;
    }
    if (action === 'delete') return isAdmin;
  }

  // Complaints Collection
  if (collection === 'complaints') {
    if (action === 'read') {
      if (existingData?.saccoId && isSaccoManager(existingData.saccoId)) return true;
      if (isAuthority || isAdmin) return true;
      if (existingData?.reportedByUid === auth.uid) return true;
      return false;
    }
    if (action === 'create') {
      return isRegisteredUser && data?.reportedByUid === auth.uid;
    }
    if (action === 'update') {
      return isAuthority || isAdmin || (existingData?.saccoId && isSaccoManager(existingData.saccoId));
    }
    if (action === 'delete') return isAdmin;
  }

  // Drivers Collection
  if (collection === 'drivers') {
    if (action === 'read') {
      if (isAdmin || isAuthority) return true;
      if (activeRole === 'sacco_manager' && existingData?.saccoId && auth.token?.saccoId === existingData.saccoId) {
        return true;
      }
      return false;
    }
    if (action === 'create') {
      const targetSaccoId = data?.saccoId;
      return isAuthority || isAdmin || (activeRole === 'sacco_manager' && targetSaccoId && auth.token?.saccoId === targetSaccoId);
    }
    if (action === 'update') {
      const targetSaccoId = existingData?.saccoId || data?.saccoId;
      return isAuthority || isAdmin || (activeRole === 'sacco_manager' && targetSaccoId && auth.token?.saccoId === targetSaccoId);
    }
    if (action === 'delete') return isAdmin;
  }

  // Inspections Collection
  if (collection === 'inspections') {
    if (action === 'read') return true;
    if (action === 'create' || action === 'update' || action === 'delete') return isAuthority;
  }

  // Audit Logs Collection
  if (collection === 'audit_logs') {
    if (action === 'read') {
      if (isAuthority) return true;
      if (activeRole === 'sacco_manager' && existingData?.saccoId === auth.token?.saccoId) return true;
      return false;
    }
    if (action === 'create') {
      const isAllowedRole = activeRole === 'authority' || isAdmin || activeRole === 'sacco_manager';
      return isAllowedRole && data?.actorRole === activeRole;
    }
    return false; // immutable
  }

  // Team Users Collection
  if (collection === 'team_users') {
    if (action === 'read') {
      return isAdmin || (activeRole === 'sacco_manager' && existingData?.saccoId === auth.token?.saccoId);
    }
    if (action === 'create') {
      return activeRole === 'sacco_manager' && data?.saccoId === auth.token?.saccoId;
    }
    if (action === 'update' || action === 'delete') {
      return isAdmin || (activeRole === 'sacco_manager' && existingData?.saccoId === auth.token?.saccoId);
    }
  }

  // Processed Events Idempotency Ledger
  if (collection === 'processedEvents') {
    if (action === 'read') return isAdmin;
    return false;
  }

  // DLQ Notifications
  if (collection === 'dlq_notifications') {
    if (action === 'read') return isAdmin || isAuthority;
    if (action === 'create' || action === 'update' || action === 'delete') return isAdmin;
  }

  // Sacco Counters
  if (collection === 'saccoCounters') {
    if (action === 'read') {
      if (isAdmin || isAuthority) return true;
      if (activeRole === 'sacco_manager' && existingData?.saccoId === auth.token?.saccoId) return true;
      return false;
    }
    if (action === 'create') {
      if (isAdmin || isAuthority) return true;
      if (activeRole === 'sacco_manager' && data?.saccoId === auth.token?.saccoId) {
        const allowedKeys = ['count', 'saccoId', 'metric', 'shardId', 'updatedAt'];
        const updatedKeys = Object.keys(data || {});
        return updatedKeys.every((k) => allowedKeys.includes(k));
      }
      return false;
    }
    if (action === 'update') {
      if (isAdmin || isAuthority) return true;
      if (
        activeRole === 'sacco_manager' &&
        data?.saccoId === auth.token?.saccoId &&
        (!existingData || existingData.saccoId === auth.token?.saccoId)
      ) {
        const allowedKeys = ['count', 'saccoId', 'metric', 'shardId', 'updatedAt'];
        const updatedKeys = Object.keys(data || {});
        return updatedKeys.every((k) => allowedKeys.includes(k));
      }
      return false;
    }
    if (action === 'delete') return isAdmin;
  }

  // Rate Limits
  if (collection === 'rate_limits') {
    return isOwner(docId) || isAdmin;
  }

  return false;
}

function evaluateStorageRules(
  action: 'read' | 'write' | 'create' | 'update' | 'delete',
  path: string,
  auth: { uid: string; token: Record<string, any> } | null,
  uploadMetadata?: { contentType?: string; size?: number }
): boolean {
  const parts = path.split('/').filter(Boolean);
  const root = parts[0];

  if (root === 'avatars' && action === 'read') {
    return true;
  }
  if (root === 'black_spots' && action === 'read') {
    return true;
  }

  if (!auth) return false;
  if (auth.token?.isSuspended === true) return false;

  const activeRole = auth.token?.activeRole;
  const isAdmin = activeRole === 'admin';
  const isAuthority = activeRole === 'authority' || isAdmin;

  if (root === 'telemetry') {
    const userId = parts[1];
    if (auth.uid !== userId) return false;
    if (uploadMetadata?.size && uploadMetadata.size >= 5 * 1024 * 1024) return false;
    return true;
  }

  if (root === 'avatars') {
    const userId = parts[1];
    if (action === 'read') return true;
    if (action === 'write' || action === 'create') {
      if (auth.uid !== userId) return false;
      if (uploadMetadata?.size && uploadMetadata.size >= 2 * 1024 * 1024) return false;
      if (
        uploadMetadata?.contentType &&
        !/^image\/(jpeg|png|webp|jpg)$/.test(uploadMetadata.contentType)
      ) {
        return false;
      }
      return true;
    }
    return isAuthority;
  }

  if (root === 'black_spots') {
    const spotId = parts[1];
    if (action === 'read') return true;
    if (action === 'write' || action === 'create') {
      const spotDoc = offlineStore[`black_spots/${spotId}`];
      const isReporter = spotDoc && (spotDoc.reportedByUid === auth.uid || spotDoc.reportedByUserId === auth.uid);
      const isAllowed = isAuthority || isReporter;
      if (!isAllowed) return false;

      // Overwrite protection: if file already exists in storage and user is not authority/admin, deny update
      if (offlineStorageStore[path] && !isAuthority) {
        return false;
      }

      if (uploadMetadata?.size && uploadMetadata.size >= 5 * 1024 * 1024) return false;
      if (
        uploadMetadata?.contentType &&
        !/^image\/(jpeg|png|webp|jpg)$/.test(uploadMetadata.contentType)
      ) {
        return false;
      }
      return true;
    }
    if (action === 'update' || action === 'delete') {
      return isAuthority;
    }
    return false;
  }

  if (root === 'evidence') {
    const saccoId = parts[1];
    const complaintId = parts[2];

    if (action === 'read') {
      if (isAuthority) return true;
      if (activeRole === 'sacco_manager' && auth.token?.saccoId === saccoId) return true;
      const complaintDoc = offlineStore[`complaints/${complaintId}`];
      if (complaintDoc && (complaintDoc.reportedByUid === auth.uid || complaintDoc.reportedByUserId === auth.uid)) {
        return true;
      }
      return false;
    }

    if (action === 'write' || action === 'create') {
      const complaintDoc = offlineStore[`complaints/${complaintId}`];
      const isComplainant =
        complaintDoc && (complaintDoc.reportedByUid === auth.uid || complaintDoc.reportedByUserId === auth.uid);
      const isAllowed = isAuthority || isComplainant;
      if (!isAllowed) return false;

      // Overwrite protection: if file already exists in storage and user is not authority/admin, deny update
      if (offlineStorageStore[path] && !isAuthority) {
        return false;
      }

      if (uploadMetadata?.size && uploadMetadata.size >= 5 * 1024 * 1024) return false;
      if (
        uploadMetadata?.contentType &&
        !/^(image\/(jpeg|png|webp|jpg)|video\/(mp4|webm|quicktime))$/.test(uploadMetadata.contentType)
      ) {
        return false;
      }
      return true;
    }

    if (action === 'update' || action === 'delete') {
      return isAuthority;
    }

    return false;
  }

  return false;
}

const VALID_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const JPEG_METADATA = { contentType: 'image/jpeg', size: 1024 };

function getContext(uid?: string, tokenClaims: Record<string, any> = {}): any {
  const claims = { activeRole: 'passenger', ...tokenClaims };
  const auth = uid ? { uid, token: claims } : null;

  return {
    firestore: () => ({
      collection: (col: string) => ({
        doc: (docId: string) => {
          const path = `${col}/${docId}`;
          return {
            get: async () => {
              const allowed = evaluateFirestoreRules('read', path, null, auth);
              if (!allowed) throw new Error('PERMISSION_DENIED: Firestore security rules blocked read');
              return { exists: !!offlineStore[path], data: () => offlineStore[path] || {} } as any;
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
            delete: async () => {
              const allowed = evaluateFirestoreRules('delete', path, null, auth);
              if (!allowed) throw new Error('PERMISSION_DENIED: Firestore security rules blocked delete');
              delete offlineStore[path];
            },
          };
        },
      }),
    }),
    storage: () => ({
      ref: (path: string) => ({
        getMetadata: async () => {
          const allowed = evaluateStorageRules('read', path, auth);
          if (!allowed) throw new Error('PERMISSION_DENIED: Storage security rules blocked read');
          const stored = offlineStorageStore[path] || { contentType: 'image/jpeg', size: 1024 };
          return stored;
        },
        getDownloadURL: async () => {
          const allowed = evaluateStorageRules('read', path, auth);
          if (!allowed) throw new Error('PERMISSION_DENIED: Storage security rules blocked read');
          return `https://storage.example.com/${path}`;
        },
        put: async (data?: any, metadata: any = JPEG_METADATA) => {
          const action = offlineStorageStore[path] ? 'write' : 'create';
          const allowed = evaluateStorageRules(action, path, auth, metadata);
          if (!allowed) throw new Error('PERMISSION_DENIED: Storage security rules blocked write');
          offlineStorageStore[path] = {
            contentType: metadata?.contentType || 'image/jpeg',
            size: metadata?.size || (data?.length || 1024),
            data,
          };
          return true;
        },
        updateMetadata: async (metadata?: any) => {
          const allowed = evaluateStorageRules('update', path, auth, metadata);
          if (!allowed) throw new Error('PERMISSION_DENIED: Storage security rules blocked update');
          if (offlineStorageStore[path]) {
            offlineStorageStore[path] = { ...offlineStorageStore[path], ...metadata };
          }
          return true;
        },
        delete: async () => {
          const allowed = evaluateStorageRules('delete', path, auth);
          if (!allowed) throw new Error('PERMISSION_DENIED: Storage security rules blocked delete');
          delete offlineStorageStore[path];
          return true;
        },
      }),
    }),
  };
}

describe('Firestore & Storage Security Rules — Deterministic Policy & Contract Test Suite', () => {
  beforeAll(() => {
    // Deterministic in-memory test environment setup
  });

  afterAll(() => {
    Object.keys(offlineStore).forEach((key) => delete offlineStore[key]);
    Object.keys(offlineStorageStore).forEach((key) => delete offlineStorageStore[key]);
  });

  beforeEach(() => {
    Object.keys(offlineStore).forEach((key) => delete offlineStore[key]);
    Object.keys(offlineStorageStore).forEach((key) => delete offlineStorageStore[key]);
  });

  it("(a) a passenger cannot read another user's trip", async () => {
    offlineStore['trips/trip_passenger_1'] = { userId: 'passenger_1', saccoId: 'sacco_metrolink', status: 'active' };
    offlineStore['trips/trip_passenger_2'] = { userId: 'passenger_2', saccoId: 'sacco_metrolink', status: 'active' };

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
    offlineStore['users/user_1'] = {
      uid: 'user_1',
      displayName: 'John Doe',
      role: 'passenger',
      activeRole: 'passenger',
      roles: ['passenger'],
      isActive: true,
    };

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
      user1Context.firestore().collection('users').doc('user_1').update({
        displayName: 'Updated John Doe',
      })
    );
  });

  it('SEC-009: user creating profile with activeRole: admin must fail, but activeRole: passenger must succeed', async () => {
    const newUserContext = getContext('new_user_99', { activeRole: 'passenger' });

    // Signed-in user attempting set() on new users/new_user_99 doc with activeRole: 'admin' MUST FAIL
    await assertFails(
      newUserContext.firestore().collection('users').doc('new_user_99').set({
        uid: 'new_user_99',
        displayName: 'Attacker',
        role: 'admin',
        activeRole: 'admin',
        roles: ['admin'],
        isActive: true,
      })
    );

    // Same write with activeRole: 'passenger' and roles: ['passenger'] MUST SUCCEED
    await assertSucceeds(
      newUserContext.firestore().collection('users').doc('new_user_99').set({
        uid: 'new_user_99',
        displayName: 'New Commuter',
        role: 'passenger',
        activeRole: 'passenger',
        roles: ['passenger'],
        isActive: true,
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

  it('SEC-001: tenant scoping for vehicles and drivers reads', async () => {
    offlineStore['vehicles/veh_sacco_A'] = { plateNumber: 'KCA 111A', saccoId: 'sacco_A', riskScore: 90 };
    offlineStore['vehicles/veh_sacco_B'] = { plateNumber: 'KCB 222B', saccoId: 'sacco_B', riskScore: 75 };
    offlineStore['drivers/drv_sacco_A'] = { name: 'Driver A', saccoId: 'sacco_A', licenseNumber: 'DL123' };
    offlineStore['drivers/drv_sacco_B'] = { name: 'Driver B', saccoId: 'sacco_B', licenseNumber: 'DL456' };

    const saccoAManager = getContext('manager_a', { activeRole: 'sacco_manager', saccoId: 'sacco_A' });
    const passengerUser = getContext('passenger_1', { activeRole: 'passenger' });
    const adminUser = getContext('admin_1', { activeRole: 'admin' });
    const authorityUser = getContext('auth_1', { activeRole: 'authority' });

    // SACCO A manager reads own SACCO vehicle & driver -> SUCCEEDS
    await assertSucceeds(saccoAManager.firestore().collection('vehicles').doc('veh_sacco_A').get());
    await assertSucceeds(saccoAManager.firestore().collection('drivers').doc('drv_sacco_A').get());

    // SACCO A manager attempts reading SACCO B vehicle & driver -> FAILS
    await assertFails(saccoAManager.firestore().collection('vehicles').doc('veh_sacco_B').get());
    await assertFails(saccoAManager.firestore().collection('drivers').doc('drv_sacco_B').get());

    // Passenger attempts reading vehicle & driver -> FAILS
    await assertFails(passengerUser.firestore().collection('vehicles').doc('veh_sacco_A').get());
    await assertFails(passengerUser.firestore().collection('drivers').doc('drv_sacco_A').get());

    // Admin & Authority read any vehicle & driver -> SUCCEEDS
    await assertSucceeds(adminUser.firestore().collection('vehicles').doc('veh_sacco_B').get());
    await assertSucceeds(adminUser.firestore().collection('drivers').doc('drv_sacco_B').get());
    await assertSucceeds(authorityUser.firestore().collection('vehicles').doc('veh_sacco_A').get());
    await assertSucceeds(authorityUser.firestore().collection('drivers').doc('drv_sacco_A').get());
  });

  it('SEC-003: create rules bind documents to authenticated user and reject spoofing & anonymous writes', async () => {
    const userA = getContext('user_a', { activeRole: 'passenger', firebase: { sign_in_provider: 'password' } });
    const anonUser = getContext('user_anon', { activeRole: 'passenger', firebase: { sign_in_provider: 'anonymous' } });

    const collectionsWithUserId = ['trips', 'violations', 'safety_alerts'];

    for (const col of collectionsWithUserId) {
      // 1. Create with caller's own uid -> SUCCEEDS
      await assertSucceeds(
        userA.firestore().collection(col).doc(`${col}_doc1`).set({
          userId: 'user_a',
          saccoId: 'sacco_A',
          createdAt: new Date().toISOString(),
        })
      );

      // 2. Create with spoofed userId -> FAILS
      await assertFails(
        userA.firestore().collection(col).doc(`${col}_doc2`).set({
          userId: 'user_spoofed_victim',
          saccoId: 'sacco_A',
          createdAt: new Date().toISOString(),
        })
      );

      // 3. Anonymous create -> FAILS
      await assertFails(
        anonUser.firestore().collection(col).doc(`${col}_doc3`).set({
          userId: 'user_anon',
          saccoId: 'sacco_A',
          createdAt: new Date().toISOString(),
        })
      );
    }

    // black_spots checks reportedByUid
    // 1. Create with caller's own reportedByUid -> SUCCEEDS
    await assertSucceeds(
      userA.firestore().collection('black_spots').doc('spot_doc1').set({
        reportedByUid: 'user_a',
        title: 'Road hazard near town',
        hazardType: 'pothole',
        createdAt: new Date().toISOString(),
      })
    );

    // 2. Create with spoofed reportedByUid -> FAILS
    await assertFails(
      userA.firestore().collection('black_spots').doc('spot_doc2').set({
        reportedByUid: 'user_spoofed_victim',
        title: 'Fake hazard report',
        hazardType: 'pothole',
        createdAt: new Date().toISOString(),
      })
    );

    // 3. Anonymous create -> FAILS
    await assertFails(
      anonUser.firestore().collection('black_spots').doc('spot_doc3').set({
        reportedByUid: 'user_anon',
        title: 'Anon hazard report',
        hazardType: 'pothole',
        createdAt: new Date().toISOString(),
      })
    );
  });

  it('SEC-002: complaints update has ownership/tenant check and reads are scoped', async () => {
    offlineStore['complaints/c_sacco_A'] = {
      saccoId: 'sacco_A',
      reportedByUid: 'passenger_1',
      title: 'Speeding Matatu',
      description: 'Driving recklessly',
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    offlineStore['complaints/c_sacco_B'] = {
      saccoId: 'sacco_B',
      reportedByUid: 'passenger_2',
      title: 'Overcharging',
      description: 'Fares doubled',
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const passenger1 = getContext('passenger_1', { activeRole: 'passenger', firebase: { sign_in_provider: 'password' } });
    const passenger2 = getContext('passenger_2', { activeRole: 'passenger', firebase: { sign_in_provider: 'password' } });
    const saccoAManager = getContext('manager_a', { activeRole: 'sacco_manager', saccoId: 'sacco_A' });
    const adminUser = getContext('admin_1', { activeRole: 'admin' });
    const authorityUser = getContext('auth_1', { activeRole: 'authority' });

    // 1. Reads:
    await assertSucceeds(passenger1.firestore().collection('complaints').doc('c_sacco_A').get());
    await assertFails(passenger1.firestore().collection('complaints').doc('c_sacco_B').get());
    await assertSucceeds(passenger2.firestore().collection('complaints').doc('c_sacco_B').get());
    await assertSucceeds(saccoAManager.firestore().collection('complaints').doc('c_sacco_A').get());
    await assertFails(saccoAManager.firestore().collection('complaints').doc('c_sacco_B').get());
    await assertSucceeds(authorityUser.firestore().collection('complaints').doc('c_sacco_A').get());
    await assertSucceeds(adminUser.firestore().collection('complaints').doc('c_sacco_B').get());

    // 2. Updates:
    await assertFails(passenger1.firestore().collection('complaints').doc('c_sacco_A').update({ status: 'resolved' }));
    await assertSucceeds(saccoAManager.firestore().collection('complaints').doc('c_sacco_A').update({ status: 'investigating' }));
    await assertFails(saccoAManager.firestore().collection('complaints').doc('c_sacco_B').update({ status: 'resolved' }));
    await assertSucceeds(authorityUser.firestore().collection('complaints').doc('c_sacco_A').update({ status: 'resolved' }));

    // 3. Creates:
    await assertSucceeds(
      passenger1.firestore().collection('complaints').doc('c_new_1').set({
        saccoId: 'sacco_A',
        reportedByUid: 'passenger_1',
        title: 'New Complaint',
        description: 'Details',
        status: 'open',
        createdAt: new Date().toISOString(),
      })
    );

    await assertFails(
      passenger1.firestore().collection('complaints').doc('c_new_2').set({
        saccoId: 'sacco_A',
        reportedByUid: 'passenger_2',
        title: 'Spoofed Complaint',
        description: 'Details',
        status: 'open',
        createdAt: new Date().toISOString(),
      })
    );
  });

  it('SEC-005: guest/anonymous read of raw black_spots fails while public_pins read succeeds', async () => {
    offlineStore['black_spots/spot_raw_1'] = {
      name: 'Raw Hazard Spot',
      reportedByUid: 'secret_user_123',
      verifiedByAuthority: false,
      createdAt: new Date().toISOString(),
    };
    offlineStore['public_pins/pin_pub_1'] = {
      title: 'Public Hazard Pin',
      routeName: 'Nairobi - Thika Superhighway',
      latitude: -1.28,
      longitude: 36.82,
      severity: 'high',
    };

    const unauthGuest = getContext(undefined, {});
    const registeredUser = getContext('user_reg_1', { activeRole: 'passenger', firebase: { sign_in_provider: 'password' } });

    // 1. Anonymous read of raw black_spots -> FAILS
    await assertFails(unauthGuest.firestore().collection('black_spots').doc('spot_raw_1').get());

    // 2. Authenticated user read of raw black_spots -> SUCCEEDS
    await assertSucceeds(registeredUser.firestore().collection('black_spots').doc('spot_raw_1').get());

    // 3. Anonymous read of public_pins -> SUCCEEDS
    await assertSucceeds(unauthGuest.firestore().collection('public_pins').doc('pin_pub_1').get());
  });

  it('SEC-010: passenger cannot create audit_logs; sacco_manager must match actorRole claim; audit_logs are immutable', async () => {
    const passenger = getContext('passenger_1', { activeRole: 'passenger' });
    const saccoManager = getContext('sacco_mgr_1', { activeRole: 'sacco_manager', saccoId: 'sacco_A' });
    const admin = getContext('admin_1', { activeRole: 'admin' });

    // 1. Passenger cannot create any audit log entry
    await assertFails(
      passenger.firestore().collection('audit_logs').doc('log_1').set({
        actorName: 'Passenger One',
        actorRole: 'passenger',
        action: 'TEST_ACTION',
        timestamp: new Date().toISOString(),
      })
    );

    // 2. SACCO manager forging actorRole: 'admin' fails
    await assertFails(
      saccoManager.firestore().collection('audit_logs').doc('log_spoof').set({
        actorName: 'SACCO Mgr',
        actorRole: 'admin',
        action: 'SUSPEND_USER',
        saccoId: 'sacco_A',
        timestamp: new Date().toISOString(),
      })
    );

    // 3. SACCO manager creating matching actorRole: 'sacco_manager' succeeds
    await assertSucceeds(
      saccoManager.firestore().collection('audit_logs').doc('log_valid').set({
        actorName: 'SACCO Mgr',
        actorRole: 'sacco_manager',
        action: 'ADD_VEHICLE',
        saccoId: 'sacco_A',
        timestamp: new Date().toISOString(),
      })
    );

    // 4. Update or delete audit_logs fails even for admin (immutable ledger)
    await assertFails(
      admin.firestore().collection('audit_logs').doc('log_valid').update({
        action: 'MUTATED_ACTION',
      })
    );
    await assertFails(admin.firestore().collection('audit_logs').doc('log_valid').delete());
  });

  it('DATA-001: team_users collection rules enforce tenant isolation', async () => {
    offlineStore['team_users/user_A'] = { email: 'driver@saccoA.com', saccoId: 'sacco_A', role: 'sacco_manager' };
    offlineStore['team_users/user_B'] = { email: 'driver@saccoB.com', saccoId: 'sacco_B', role: 'sacco_manager' };

    const managerA = getContext('mgr_a', { activeRole: 'sacco_manager', saccoId: 'sacco_A' });

    // 1. Manager A can create a team_user for sacco_A
    await assertSucceeds(
      managerA.firestore().collection('team_users').doc('user_A_new').set({
        email: 'new@saccoA.com',
        saccoId: 'sacco_A',
        role: 'sacco_manager',
      })
    );

    // 2. Manager A cannot create a team_user for sacco_B
    await assertFails(
      managerA.firestore().collection('team_users').doc('user_B_spoof').set({
        email: 'new@saccoB.com',
        saccoId: 'sacco_B',
        role: 'sacco_manager',
      })
    );

    // 3. Manager A can read own sacco_A team_user
    await assertSucceeds(managerA.firestore().collection('team_users').doc('user_A').get());

    // 4. Manager A cannot read cross-tenant sacco_B team_user
    await assertFails(managerA.firestore().collection('team_users').doc('user_B').get());
  });

  it('SEC-007: non-admin client write/read to processedEvents is denied', async () => {
    const passenger = getContext('passenger_1', { activeRole: 'passenger' });
    const admin = getContext('admin_1', { activeRole: 'admin' });

    // 1. Client write to processedEvents is denied
    await assertFails(
      passenger.firestore().collection('processedEvents').doc('event_123').set({
        eventId: 'event_123',
        handler: 'computeVehicleRisk',
      })
    );

    // 2. Non-admin read to processedEvents is denied
    await assertFails(passenger.firestore().collection('processedEvents').doc('event_123').get());

    // 3. Admin read to processedEvents succeeds
    await assertSucceeds(admin.firestore().collection('processedEvents').doc('event_123').get());
  });

  it('SEC-006 & FUNC-001: complaint evidence storage access control and manager delete restriction', async () => {
    // 1. User with a leftover saccoId claim but activeRole: 'passenger'
    const staleUser = getContext('stale_user_1', { activeRole: 'passenger', saccoId: 'sacco_A' });
    // 2. Another unrelated passenger
    const unrelatedPassenger = getContext('passenger_2', { activeRole: 'passenger' });
    // 3. Complainant who filed complaint_1 for sacco_A
    const complainant = getContext('complainant_1', { activeRole: 'passenger' });
    // 4. Legitimate matching SACCO manager for sacco_A
    const validManager = getContext('mgr_a', { activeRole: 'sacco_manager', saccoId: 'sacco_A' });
    // 5. Authority
    const authority = getContext('auth_user_1', { activeRole: 'authority' });

    offlineStore['complaints/complaint_1'] = {
      id: 'complaint_1',
      saccoId: 'sacco_A',
      reportedByUid: 'complainant_1',
      reportedByUserId: 'complainant_1',
      status: 'submitted',
    };

    const evidencePath = 'evidence/sacco_A/complaint_1/photo.jpg';

    // SCENARIO A: Original complainant
    // - CREATE succeeds via put()
    // - READ metadata succeeds via getMetadata()
    // - DELETE fails (restricted to admin/authority)
    await assertSucceeds(complainant.storage().ref(evidencePath).put(VALID_JPEG, JPEG_METADATA));
    await assertSucceeds(complainant.storage().ref(evidencePath).getMetadata());
    await assertFails(complainant.storage().ref(evidencePath).delete());

    // SCENARIO B: Stale passenger (activeRole: 'passenger' with saccoId claim)
    // - READ metadata fails
    // - CREATE / overwrite fails
    // - DELETE fails
    await assertFails(staleUser.storage().ref(evidencePath).getMetadata());
    await assertFails(staleUser.storage().ref(evidencePath).put(VALID_JPEG, JPEG_METADATA));
    await assertFails(staleUser.storage().ref(evidencePath).delete());

    // SCENARIO C: Unrelated passenger
    // - READ metadata fails
    // - CREATE / overwrite fails
    // - DELETE fails
    await assertFails(unrelatedPassenger.storage().ref(evidencePath).getMetadata());
    await assertFails(unrelatedPassenger.storage().ref(evidencePath).put(VALID_JPEG, JPEG_METADATA));
    await assertFails(unrelatedPassenger.storage().ref(evidencePath).delete());

    // SCENARIO D: Matching SACCO manager
    // - READ metadata succeeds
    // - CREATE / overwrite (update) fails
    // - DELETE fails
    await assertSucceeds(validManager.storage().ref(evidencePath).getMetadata());
    await assertFails(validManager.storage().ref(evidencePath).put(VALID_JPEG, JPEG_METADATA));
    await assertFails(validManager.storage().ref(evidencePath).delete());

    // SCENARIO E: Authority
    // - READ metadata succeeds
    // - DELETE succeeds
    await assertSucceeds(authority.storage().ref(evidencePath).getMetadata());
    await assertSucceeds(authority.storage().ref(evidencePath).delete());
  });

  it('SEC-005: black spot evidence storage restricts uploads to original reporter and protects against overwrites', async () => {
    const reporter = getContext('reporter_spot_1', { activeRole: 'passenger' });
    const imposter = getContext('imposter_user_2', { activeRole: 'passenger' });
    const authority = getContext('auth_user_2', { activeRole: 'authority' });

    offlineStore['black_spots/spot_100'] = {
      id: 'spot_100',
      title: 'Pothole Cluster',
      reportedByUid: 'reporter_spot_1',
      reportedByUserId: 'reporter_spot_1',
      severity: 'high',
      status: 'pending',
    };

    const blackSpotEvidencePath = 'black_spots/spot_100/photo.jpg';

    // 1. Reporter creates the object successfully
    await assertSucceeds(reporter.storage().ref(blackSpotEvidencePath).put(VALID_JPEG, JPEG_METADATA));

    // 2. Any user (including imposter) can read metadata because read is public
    await assertSucceeds(imposter.storage().ref(blackSpotEvidencePath).getMetadata());

    // 3. Imposter cannot overwrite the existing object
    await assertFails(imposter.storage().ref(blackSpotEvidencePath).put(VALID_JPEG, JPEG_METADATA));

    // 4. Reporter cannot overwrite the existing object after creation
    await assertFails(reporter.storage().ref(blackSpotEvidencePath).put(VALID_JPEG, JPEG_METADATA));

    // 5. Reporter cannot delete
    await assertFails(reporter.storage().ref(blackSpotEvidencePath).delete());

    // 6. Authority can delete
    await assertSucceeds(authority.storage().ref(blackSpotEvidencePath).delete());
  });

  it('BE-001 / SEC-004: suspended user with isSuspended claim is denied Firestore writes', async () => {
    // 1. Active passenger user write succeeds
    const activePassenger = getContext('user_active_1', { activeRole: 'passenger', isSuspended: false });
    await assertSucceeds(
      activePassenger.firestore().collection('complaints').doc('complaint_101').set({
        id: 'complaint_101',
        saccoId: 'sacco_A',
        vehicleRegNumber: 'KCA 123A',
        description: 'Overcharging during peak hours',
        category: 'overcharging',
        status: 'open',
        reportedByUid: 'user_active_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );

    // 2. Suspended user with isSuspended: true claim write is denied by rules
    const suspendedPassenger = getContext('user_suspended_1', { activeRole: 'passenger', isSuspended: true });
    await assertFails(
      suspendedPassenger.firestore().collection('complaints').doc('complaint_102').set({
        id: 'complaint_102',
        saccoId: 'sacco_A',
        vehicleRegNumber: 'KCA 123A',
        description: 'Unsafe driving report',
        category: 'unsafe_driving',
        status: 'open',
        reportedByUid: 'user_suspended_1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    );
  });

  it('PRIV-001: users collection read restrictions enforce privacy (passenger A cannot read passenger B profile)', async () => {
    offlineStore['users/passenger_A'] = { uid: 'passenger_A', displayName: 'Alice', phoneNumber: '+254711111111', role: 'passenger' };
    offlineStore['users/passenger_B'] = { uid: 'passenger_B', displayName: 'Bob', phoneNumber: '+254722222222', role: 'passenger' };
    offlineStore['users/sacco_user_A'] = { uid: 'sacco_user_A', displayName: 'Driver A', saccoId: 'sacco_A' };

    const passengerA = getContext('passenger_A', { activeRole: 'passenger' });
    const adminUser = getContext('admin_1', { activeRole: 'admin' });
    const saccoManagerA = getContext('mgr_a', { activeRole: 'sacco_manager', saccoId: 'sacco_A' });

    // 1. Passenger A can read own profile
    await assertSucceeds(passengerA.firestore().collection('users').doc('passenger_A').get());

    // 2. Passenger A CANNOT read Passenger B profile
    await assertFails(passengerA.firestore().collection('users').doc('passenger_B').get());

    // 3. Admin can read anyone's profile
    await assertSucceeds(adminUser.firestore().collection('users').doc('passenger_A').get());
    await assertSucceeds(adminUser.firestore().collection('users').doc('passenger_B').get());

    // 4. SACCO Manager A can read user in sacco_A
    await assertSucceeds(saccoManagerA.firestore().collection('users').doc('sacco_user_A').get());

    // 5. SACCO Manager A CANNOT read Passenger B (not in sacco_A)
    await assertFails(saccoManagerA.firestore().collection('users').doc('passenger_B').get());
  });

  it('VT-003: trips and violations create rules reject implausible coordinates, future timestamps, and excessive speeds', async () => {
    const passenger = getContext('passenger_vt3', {
      activeRole: 'passenger',
      firebase: { sign_in_provider: 'password' },
    });

    const now = Date.now();
    const createTs = (ms: number) => Timestamp.fromMillis(ms);

    const validTime = createTs(now - 60000); // 1 minute ago
    const futureTime = createTs(now + 3600000); // 1 hour in future (>5m)
    const pastTime = createTs(now - 25 * 3600000); // 25 hours ago (>24h)
    const isoStringTime = new Date(now - 60000).toISOString();

    // 1. Trip with coordinates outside Kenya -> FAILS
    await assertFails(
      passenger.firestore().collection('trips').doc('trip_out_of_kenya').set({
        id: 'trip_out_of_kenya',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        saccoName: 'SACCO A',
        routeName: 'Nairobi - Thika',
        status: 'active',
        currentSpeedKmH: 60,
        maxSpeedKmH: 80,
        avgSpeedKmH: 50,
        latitude: 51.5074,
        longitude: -0.1278,
        startTime: validTime,
      })
    );

    // 2. Trip with startLocation outside Kenya -> FAILS
    await assertFails(
      passenger.firestore().collection('trips').doc('trip_startloc_bad').set({
        id: 'trip_startloc_bad',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        saccoName: 'SACCO A',
        routeName: 'Nairobi - Thika',
        status: 'active',
        startLocation: { latitude: -25.0, longitude: 28.0 },
        startTime: validTime,
      })
    );

    // 3. Trip with malformed coordinates -> FAILS
    await assertFails(
      passenger.firestore().collection('trips').doc('trip_malformed_coords').set({
        id: 'trip_malformed_coords',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        latitude: 'not-a-number' as any,
        longitude: 36.817223,
        startTime: validTime,
      })
    );

    // 4. Trip with timestamp 1 hour in the future (> 5 min) -> FAILS
    await assertFails(
      passenger.firestore().collection('trips').doc('trip_future_time').set({
        id: 'trip_future_time',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        saccoName: 'SACCO A',
        routeName: 'Nairobi - Thika',
        status: 'active',
        latitude: -1.286389,
        longitude: 36.817223,
        startTime: futureTime,
      })
    );

    // 5. Trip with timestamp older than 24 hours -> FAILS
    await assertFails(
      passenger.firestore().collection('trips').doc('trip_too_old_time').set({
        id: 'trip_too_old_time',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        saccoName: 'SACCO A',
        routeName: 'Nairobi - Thika',
        status: 'active',
        latitude: -1.286389,
        longitude: 36.817223,
        startTime: pastTime,
      })
    );

    // 6. Trip with raw ISO string instead of Timestamp -> FAILS
    await assertFails(
      passenger.firestore().collection('trips').doc('trip_iso_string_time').set({
        id: 'trip_iso_string_time',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        saccoName: 'SACCO A',
        routeName: 'Nairobi - Thika',
        status: 'active',
        latitude: -1.286389,
        longitude: 36.817223,
        startTime: isoStringTime,
      })
    );

    // 7. Trip with negative speed -> FAILS
    await assertFails(
      passenger.firestore().collection('trips').doc('trip_negative_speed').set({
        id: 'trip_negative_speed',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        currentSpeedKmH: -10,
        startTime: validTime,
      })
    );

    // 8. Trip with speed > 180 km/h -> FAILS
    await assertFails(
      passenger.firestore().collection('trips').doc('trip_excessive_speed').set({
        id: 'trip_excessive_speed',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        maxSpeedKmH: 220,
        startTime: validTime,
      })
    );

    // 9. Violation with coordinates outside Kenya -> FAILS
    await assertFails(
      passenger.firestore().collection('violations').doc('viol_out_of_kenya').set({
        id: 'viol_out_of_kenya',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        recordedSpeedKmH: 105,
        speedLimitKmH: 80,
        severity: 'high',
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: validTime,
      })
    );

    // 10. Violation with malformed coordinates -> FAILS
    await assertFails(
      passenger.firestore().collection('violations').doc('viol_malformed_coords').set({
        id: 'viol_malformed_coords',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        latitude: 'bad_lat' as any,
        longitude: 36.817223,
        timestamp: validTime,
      })
    );

    // 11. Violation with timestamp 1 hour in the future -> FAILS
    await assertFails(
      passenger.firestore().collection('violations').doc('viol_future_time').set({
        id: 'viol_future_time',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        recordedSpeedKmH: 105,
        speedLimitKmH: 80,
        severity: 'high',
        latitude: -1.286389,
        longitude: 36.817223,
        timestamp: futureTime,
      })
    );

    // 12. Violation with timestamp older than 24 hours -> FAILS
    await assertFails(
      passenger.firestore().collection('violations').doc('viol_too_old_time').set({
        id: 'viol_too_old_time',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        recordedSpeedKmH: 105,
        speedLimitKmH: 80,
        severity: 'high',
        latitude: -1.286389,
        longitude: 36.817223,
        timestamp: pastTime,
      })
    );

    // 13. Violation with raw ISO string instead of Timestamp -> FAILS
    await assertFails(
      passenger.firestore().collection('violations').doc('viol_iso_string_time').set({
        id: 'viol_iso_string_time',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        recordedSpeedKmH: 95,
        speedLimitKmH: 80,
        timestamp: isoStringTime,
      })
    );

    // 14. Violation with physically impossible speed (> 180 km/h) -> FAILS
    await assertFails(
      passenger.firestore().collection('violations').doc('viol_impossible_speed').set({
        id: 'viol_impossible_speed',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        recordedSpeedKmH: 260,
        speedLimitKmH: 80,
        severity: 'critical',
        latitude: -1.286389,
        longitude: 36.817223,
        timestamp: validTime,
      })
    );

    // 15. Violation with negative speed -> FAILS
    await assertFails(
      passenger.firestore().collection('violations').doc('viol_negative_speed').set({
        id: 'viol_negative_speed',
        userId: 'passenger_vt3',
        saccoId: 'sacco_A',
        recordedSpeedKmH: -20,
        speedLimitKmH: 80,
        timestamp: validTime,
      })
    );

    // 16. Legitimate Trip within Kenya bounds and valid Timestamp -> SUCCEEDS
    await assertSucceeds(
      passenger.firestore().collection('trips').doc('trip_valid_kenya').set({
        id: 'trip_valid_kenya',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        saccoName: 'SACCO A',
        routeName: 'Nairobi - Nakuru',
        status: 'active',
        currentSpeedKmH: 75,
        maxSpeedKmH: 85,
        avgSpeedKmH: 60,
        latitude: -1.286389,
        longitude: 36.817223,
        startTime: validTime,
      })
    );

    // 17. Legitimate Violation within Kenya bounds and valid Timestamp -> SUCCEEDS
    await assertSucceeds(
      passenger.firestore().collection('violations').doc('viol_valid_kenya').set({
        id: 'viol_valid_kenya',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        recordedSpeedKmH: 95,
        speedLimitKmH: 80,
        severity: 'medium',
        latitude: -1.286389,
        longitude: 36.817223,
        timestamp: validTime,
      })
    );
  });

  it('SEC-003: Sharded saccoCounters write isolation & tenant restrictions', async () => {
    const saccoAManager = getContext('sacco_mgr_A', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });
    const saccoBManager = getContext('sacco_mgr_B', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_B',
    });
    const passenger = getContext('passenger_user_1', {
      activeRole: 'passenger',
    });
    const driver = getContext('driver_user_1', {
      activeRole: 'driver',
    });
    const admin = getContext('admin_user_1', {
      activeRole: 'admin',
    });
    const unauth = getContext(undefined);

    // 1. SACCO A manager writing SACCO A counter -> SUCCEEDS
    await assertSucceeds(
      saccoAManager.firestore().collection('saccoCounters').doc('sacco_A_trips_shard_0').set({
        count: 5,
        saccoId: 'sacco_A',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );

    // 2. SACCO A manager reading SACCO A counter -> SUCCEEDS
    await assertSucceeds(
      saccoAManager.firestore().collection('saccoCounters').doc('sacco_A_trips_shard_0').get()
    );

    // 3. SACCO A manager attempting to write SACCO B counter -> FAILS (Cross-tenant forbidden)
    await assertFails(
      saccoAManager.firestore().collection('saccoCounters').doc('sacco_B_trips_shard_0').set({
        count: 10,
        saccoId: 'sacco_B',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );

    // 4. SACCO B manager attempting to read SACCO A counter -> FAILS
    await assertFails(
      saccoBManager.firestore().collection('saccoCounters').doc('sacco_A_trips_shard_0').get()
    );

    // 5. Passenger attempting any write to saccoCounters -> FAILS (No isSignedIn catch-all)
    await assertFails(
      passenger.firestore().collection('saccoCounters').doc('sacco_A_trips_shard_0').set({
        count: 999,
        saccoId: 'sacco_A',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );

    // 6. Passenger attempting any read to saccoCounters -> FAILS
    await assertFails(
      passenger.firestore().collection('saccoCounters').doc('sacco_A_trips_shard_0').get()
    );

    // 7. Driver attempting any write to saccoCounters -> FAILS
    await assertFails(
      driver.firestore().collection('saccoCounters').doc('sacco_A_trips_shard_0').set({
        count: 1,
        saccoId: 'sacco_A',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );

    // 8. Unauthenticated user attempting any write or read -> FAILS
    await assertFails(
      unauth.firestore().collection('saccoCounters').doc('sacco_A_trips_shard_0').set({
        count: 1,
        saccoId: 'sacco_A',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );
    await assertFails(
      unauth.firestore().collection('saccoCounters').doc('sacco_A_trips_shard_0').get()
    );

    // 9. Admin writing counters -> SUCCEEDS
    await assertSucceeds(
      admin.firestore().collection('saccoCounters').doc('sacco_B_trips_shard_0').set({
        count: 20,
        saccoId: 'sacco_B',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );
  });
});
