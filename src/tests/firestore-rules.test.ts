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
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';

describe('Firestore Security Rules (Emulator-Backed)', { timeout: 20000 }, () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-mwendo-salama-audit',
      firestore: {
        rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8085,
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
    }
  });

  it('(a) a passenger cannot read another user’s trip', async () => {
    // 1. Seed trip for user_2 in Firestore with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'trips/trip_user_2'), {
        id: 'trip_user_2',
        userId: 'user_2',
        saccoId: 'sacco_A',
        status: 'completed',
        latitude: -1.286389,
        longitude: 36.817223,
      });
      await setDoc(doc(db, 'trips/trip_user_1'), {
        id: 'trip_user_1',
        userId: 'user_1',
        saccoId: 'sacco_A',
        status: 'completed',
        latitude: -1.286389,
        longitude: 36.817223,
      });
    });

    const passenger1 = testEnv.authenticatedContext('user_1', { activeRole: 'passenger' });

    // Passenger 1 reading own trip -> SUCCEEDS
    await assertSucceeds(getDoc(doc(passenger1.firestore(), 'trips/trip_user_1')));

    // Passenger 1 reading Passenger 2's trip -> FAILS
    await assertFails(getDoc(doc(passenger1.firestore(), 'trips/trip_user_2')));
  });

  it('(b) a sacco_manager cannot write a vehicle belonging to a different saccoId', async () => {
    const saccoAManager = testEnv.authenticatedContext('manager_a', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });

    // Writing vehicle for sacco_A -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(saccoAManager.firestore(), 'vehicles/veh_sacco_A'), {
        plateNumber: 'KCA 111A',
        saccoId: 'sacco_A',
      })
    );

    // Writing vehicle for sacco_B -> FAILS
    await assertFails(
      setDoc(doc(saccoAManager.firestore(), 'vehicles/veh_sacco_B'), {
        plateNumber: 'KCB 222B',
        saccoId: 'sacco_B',
      })
    );
  });

  it('(c) a user cannot elevate their own activeRole to admin', async () => {
    // 1. Seed user profile with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/user_normal'), {
        uid: 'user_normal',
        displayName: 'Normal User',
        role: 'passenger',
        activeRole: 'passenger',
        roles: ['passenger'],
        isActive: true,
      });
    });

    const normalUser = testEnv.authenticatedContext('user_normal', {
      activeRole: 'passenger',
    });

    // Updating allowed fields (displayName) -> SUCCEEDS
    await assertSucceeds(
      updateDoc(doc(normalUser.firestore(), 'users/user_normal'), {
        displayName: 'Updated Normal User',
      })
    );

    // Attempting to escalate activeRole -> FAILS
    await assertFails(
      updateDoc(doc(normalUser.firestore(), 'users/user_normal'), {
        activeRole: 'admin',
      })
    );

    // Attempting to escalate roles array -> FAILS
    await assertFails(
      updateDoc(doc(normalUser.firestore(), 'users/user_normal'), {
        roles: ['admin'],
      })
    );
  });

  it('SEC-009: user creating profile with activeRole: admin must fail, but activeRole: passenger must succeed', async () => {
    const newUser = testEnv.authenticatedContext('new_user_99', {
      activeRole: 'passenger',
    });

    // Creation with activeRole: 'admin' MUST FAIL
    await assertFails(
      setDoc(doc(newUser.firestore(), 'users/new_user_99'), {
        uid: 'new_user_99',
        displayName: 'Attacker Profile',
        role: 'admin',
        activeRole: 'admin',
        roles: ['admin'],
        isActive: true,
      })
    );

    // Creation with activeRole: 'passenger' and roles: ['passenger'] MUST SUCCEED
    await assertSucceeds(
      setDoc(doc(newUser.firestore(), 'users/new_user_99'), {
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
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'analytics/sacco_B_stats'), {
        saccoId: 'sacco_B',
        riskScore: 88,
      });
    });

    const saccoAManager = testEnv.authenticatedContext('manager_a', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });
    const saccoBManager = testEnv.authenticatedContext('manager_b', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_B',
    });

    // SACCO A Manager reading SACCO B analytics -> FAILS
    await assertFails(getDoc(doc(saccoAManager.firestore(), 'analytics/sacco_B_stats')));

    // SACCO B Manager reading SACCO B analytics -> SUCCEEDS
    await assertSucceeds(getDoc(doc(saccoBManager.firestore(), 'analytics/sacco_B_stats')));
  });

  it('blocks writes when user has isSuspended=true claim', async () => {
    const suspendedContext = testEnv.authenticatedContext('suspended_user', {
      activeRole: 'passenger',
      isSuspended: true,
    });

    await assertFails(
      setDoc(doc(suspendedContext.firestore(), 'trips/trip_new'), {
        userId: 'suspended_user',
        saccoId: 'sacco_A',
      })
    );
  });

  it('SEC-001: tenant scoping for vehicles and drivers reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'vehicles/veh_sacco_A'), {
        plateNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        riskScore: 90,
      });
      await setDoc(doc(db, 'vehicles/veh_sacco_B'), {
        plateNumber: 'KCB 222B',
        saccoId: 'sacco_B',
        riskScore: 75,
      });
      await setDoc(doc(db, 'drivers/drv_sacco_A'), {
        name: 'Driver A',
        saccoId: 'sacco_A',
        licenseNumber: 'DL123',
      });
      await setDoc(doc(db, 'drivers/drv_sacco_B'), {
        name: 'Driver B',
        saccoId: 'sacco_B',
        licenseNumber: 'DL456',
      });
    });

    const saccoAManager = testEnv.authenticatedContext('manager_a', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });
    const passengerUser = testEnv.authenticatedContext('passenger_1', {
      activeRole: 'passenger',
    });
    const adminUser = testEnv.authenticatedContext('admin_1', {
      activeRole: 'admin',
    });
    const authorityUser = testEnv.authenticatedContext('auth_1', {
      activeRole: 'authority',
    });

    // SACCO A manager reads own SACCO vehicle & driver -> SUCCEEDS
    await assertSucceeds(getDoc(doc(saccoAManager.firestore(), 'vehicles/veh_sacco_A')));
    await assertSucceeds(getDoc(doc(saccoAManager.firestore(), 'drivers/drv_sacco_A')));

    // SACCO A manager attempts reading SACCO B vehicle & driver -> FAILS
    await assertFails(getDoc(doc(saccoAManager.firestore(), 'vehicles/veh_sacco_B')));
    await assertFails(getDoc(doc(saccoAManager.firestore(), 'drivers/drv_sacco_B')));

    // Passenger attempts reading vehicle & driver -> FAILS
    await assertFails(getDoc(doc(passengerUser.firestore(), 'vehicles/veh_sacco_A')));
    await assertFails(getDoc(doc(passengerUser.firestore(), 'drivers/drv_sacco_A')));

    // Admin & Authority read any vehicle & driver -> SUCCEEDS
    await assertSucceeds(getDoc(doc(adminUser.firestore(), 'vehicles/veh_sacco_B')));
    await assertSucceeds(getDoc(doc(adminUser.firestore(), 'drivers/drv_sacco_B')));
    await assertSucceeds(getDoc(doc(authorityUser.firestore(), 'vehicles/veh_sacco_A')));
    await assertSucceeds(getDoc(doc(authorityUser.firestore(), 'drivers/drv_sacco_A')));
  });

  it('SEC-003: create rules bind documents to authenticated user and reject spoofing & anonymous writes', async () => {
    const userA = testEnv.authenticatedContext('user_a', {
      activeRole: 'passenger',
      firebase: { sign_in_provider: 'password' },
    });
    const anonUser = testEnv.authenticatedContext('user_anon', {
      activeRole: 'passenger',
      firebase: { sign_in_provider: 'anonymous' },
    });

    const now = Date.now();
    const validTime = Timestamp.fromMillis(now - 60000);

    // 1. Trips
    await assertSucceeds(
      setDoc(doc(userA.firestore(), 'trips/trips_doc1'), {
        id: 'trips_doc1',
        userId: 'user_a',
        saccoId: 'sacco_A',
        latitude: -1.286389,
        longitude: 36.817223,
        startTime: validTime,
        currentSpeedKmH: 60,
        maxSpeedKmH: 80,
      })
    );
    await assertFails(
      setDoc(doc(userA.firestore(), 'trips/trips_doc2'), {
        id: 'trips_doc2',
        userId: 'user_spoofed_victim',
        saccoId: 'sacco_A',
        latitude: -1.286389,
        longitude: 36.817223,
        startTime: validTime,
      })
    );
    await assertFails(
      setDoc(doc(anonUser.firestore(), 'trips/trips_doc3'), {
        id: 'trips_doc3',
        userId: 'user_anon',
        saccoId: 'sacco_A',
        latitude: -1.286389,
        longitude: 36.817223,
        startTime: validTime,
      })
    );

    // 2. Violations
    await assertSucceeds(
      setDoc(doc(userA.firestore(), 'violations/viol_doc1'), {
        id: 'viol_doc1',
        userId: 'user_a',
        saccoId: 'sacco_A',
        latitude: -1.286389,
        longitude: 36.817223,
        timestamp: validTime,
        recordedSpeedKmH: 95,
      })
    );
    await assertFails(
      setDoc(doc(userA.firestore(), 'violations/viol_doc2'), {
        id: 'viol_doc2',
        userId: 'user_spoofed_victim',
        saccoId: 'sacco_A',
        latitude: -1.286389,
        longitude: 36.817223,
        timestamp: validTime,
        recordedSpeedKmH: 95,
      })
    );
    await assertFails(
      setDoc(doc(anonUser.firestore(), 'violations/viol_doc3'), {
        id: 'viol_doc3',
        userId: 'user_anon',
        saccoId: 'sacco_A',
        latitude: -1.286389,
        longitude: 36.817223,
        timestamp: validTime,
        recordedSpeedKmH: 95,
      })
    );

    // 3. Safety Alerts
    await assertSucceeds(
      setDoc(doc(userA.firestore(), 'safety_alerts/alert_doc1'), {
        id: 'alert_doc1',
        userId: 'user_a',
        saccoId: 'sacco_A',
        createdAt: new Date().toISOString(),
      })
    );
    await assertFails(
      setDoc(doc(userA.firestore(), 'safety_alerts/alert_doc2'), {
        id: 'alert_doc2',
        userId: 'user_spoofed_victim',
        saccoId: 'sacco_A',
        createdAt: new Date().toISOString(),
      })
    );
    await assertFails(
      setDoc(doc(anonUser.firestore(), 'safety_alerts/alert_doc3'), {
        id: 'alert_doc3',
        userId: 'user_anon',
        saccoId: 'sacco_A',
        createdAt: new Date().toISOString(),
      })
    );

    // 4. Black spots checks reportedByUid
    await assertSucceeds(
      setDoc(doc(userA.firestore(), 'black_spots/spot_doc1'), {
        id: 'spot_doc1',
        reportedByUid: 'user_a',
        title: 'Road hazard near town',
        hazardType: 'pothole',
        createdAt: new Date().toISOString(),
      })
    );
    await assertFails(
      setDoc(doc(userA.firestore(), 'black_spots/spot_doc2'), {
        id: 'spot_doc2',
        reportedByUid: 'user_spoofed_victim',
        title: 'Fake hazard report',
        hazardType: 'pothole',
        createdAt: new Date().toISOString(),
      })
    );
    await assertFails(
      setDoc(doc(anonUser.firestore(), 'black_spots/spot_doc3'), {
        id: 'spot_doc3',
        reportedByUid: 'user_anon',
        title: 'Anon hazard report',
        hazardType: 'pothole',
        createdAt: new Date().toISOString(),
      })
    );
  });

  it('SEC-002: complaints update has ownership/tenant check and reads are scoped', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'complaints/c_sacco_A'), {
        id: 'c_sacco_A',
        saccoId: 'sacco_A',
        reportedByUid: 'passenger_1',
        title: 'Speeding Matatu',
        description: 'Driving recklessly',
        status: 'open',
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'complaints/c_sacco_B'), {
        id: 'c_sacco_B',
        saccoId: 'sacco_B',
        reportedByUid: 'passenger_2',
        title: 'Overcharging',
        description: 'Fares doubled',
        status: 'open',
        createdAt: new Date().toISOString(),
      });
    });

    const passenger1 = testEnv.authenticatedContext('passenger_1', {
      activeRole: 'passenger',
      firebase: { sign_in_provider: 'password' },
    });
    const passenger2 = testEnv.authenticatedContext('passenger_2', {
      activeRole: 'passenger',
      firebase: { sign_in_provider: 'password' },
    });
    const saccoAManager = testEnv.authenticatedContext('manager_a', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });
    const adminUser = testEnv.authenticatedContext('admin_1', {
      activeRole: 'admin',
    });
    const authorityUser = testEnv.authenticatedContext('auth_1', {
      activeRole: 'authority',
    });

    // 1. Reads:
    await assertSucceeds(getDoc(doc(passenger1.firestore(), 'complaints/c_sacco_A')));
    await assertFails(getDoc(doc(passenger1.firestore(), 'complaints/c_sacco_B')));
    await assertSucceeds(getDoc(doc(passenger2.firestore(), 'complaints/c_sacco_B')));
    await assertSucceeds(getDoc(doc(saccoAManager.firestore(), 'complaints/c_sacco_A')));
    await assertFails(getDoc(doc(saccoAManager.firestore(), 'complaints/c_sacco_B')));
    await assertSucceeds(getDoc(doc(authorityUser.firestore(), 'complaints/c_sacco_A')));
    await assertSucceeds(getDoc(doc(adminUser.firestore(), 'complaints/c_sacco_B')));

    // 2. Updates:
    await assertFails(
      updateDoc(doc(passenger1.firestore(), 'complaints/c_sacco_A'), { status: 'resolved' })
    );
    await assertSucceeds(
      updateDoc(doc(saccoAManager.firestore(), 'complaints/c_sacco_A'), { status: 'investigating' })
    );
    await assertFails(
      updateDoc(doc(saccoAManager.firestore(), 'complaints/c_sacco_B'), { status: 'resolved' })
    );
    await assertSucceeds(
      updateDoc(doc(authorityUser.firestore(), 'complaints/c_sacco_A'), { status: 'resolved' })
    );

    // 3. Creates:
    await assertSucceeds(
      setDoc(doc(passenger1.firestore(), 'complaints/c_new_1'), {
        saccoId: 'sacco_A',
        reportedByUid: 'passenger_1',
        title: 'New Complaint',
        description: 'Details',
        status: 'open',
        createdAt: new Date().toISOString(),
      })
    );

    await assertFails(
      setDoc(doc(passenger1.firestore(), 'complaints/c_new_2'), {
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
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'black_spots/spot_raw_1'), {
        name: 'Raw Hazard Spot',
        reportedByUid: 'secret_user_123',
        verifiedByAuthority: false,
        createdAt: new Date().toISOString(),
      });
      await setDoc(doc(db, 'public_pins/pin_pub_1'), {
        title: 'Public Hazard Pin',
        routeName: 'Nairobi - Thika Superhighway',
        latitude: -1.28,
        longitude: 36.82,
        severity: 'high',
      });
    });

    const unauthGuest = testEnv.unauthenticatedContext();
    const registeredUser = testEnv.authenticatedContext('user_reg_1', {
      activeRole: 'passenger',
      firebase: { sign_in_provider: 'password' },
    });

    // 1. Anonymous / unauth read of raw black_spots -> FAILS
    await assertFails(getDoc(doc(unauthGuest.firestore(), 'black_spots/spot_raw_1')));

    // 2. Authenticated user read of raw black_spots -> SUCCEEDS
    await assertSucceeds(getDoc(doc(registeredUser.firestore(), 'black_spots/spot_raw_1')));

    // 3. Anonymous / unauth read of public_pins -> SUCCEEDS
    await assertSucceeds(getDoc(doc(unauthGuest.firestore(), 'public_pins/pin_pub_1')));
  });

  it('SEC-010: passenger cannot create audit_logs; sacco_manager must match actorRole claim; audit_logs are immutable', async () => {
    const passenger = testEnv.authenticatedContext('passenger_1', { activeRole: 'passenger' });
    const saccoManager = testEnv.authenticatedContext('sacco_mgr_1', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });
    const admin = testEnv.authenticatedContext('admin_1', { activeRole: 'admin' });

    // 1. Passenger cannot create any audit log entry
    await assertFails(
      setDoc(doc(passenger.firestore(), 'audit_logs/log_1'), {
        actorName: 'Passenger One',
        actorRole: 'passenger',
        action: 'TEST_ACTION',
        timestamp: new Date().toISOString(),
      })
    );

    // 2. SACCO manager forging actorRole: 'admin' fails
    await assertFails(
      setDoc(doc(saccoManager.firestore(), 'audit_logs/log_spoof'), {
        actorName: 'SACCO Mgr',
        actorRole: 'admin',
        action: 'SUSPEND_USER',
        saccoId: 'sacco_A',
        timestamp: new Date().toISOString(),
      })
    );

    // 3. SACCO manager creating matching actorRole: 'sacco_manager' succeeds
    await assertSucceeds(
      setDoc(doc(saccoManager.firestore(), 'audit_logs/log_valid'), {
        actorName: 'SACCO Mgr',
        actorRole: 'sacco_manager',
        action: 'ADD_VEHICLE',
        saccoId: 'sacco_A',
        timestamp: new Date().toISOString(),
      })
    );

    // 4. Update or delete audit_logs fails even for admin (immutable ledger)
    await assertFails(
      updateDoc(doc(admin.firestore(), 'audit_logs/log_valid'), {
        action: 'MUTATED_ACTION',
      })
    );
    await assertFails(deleteDoc(doc(admin.firestore(), 'audit_logs/log_valid')));
  });

  it('DATA-001: team_users collection rules enforce tenant isolation', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'team_users/user_A'), {
        email: 'driver@saccoA.com',
        saccoId: 'sacco_A',
        role: 'sacco_manager',
      });
      await setDoc(doc(db, 'team_users/user_B'), {
        email: 'driver@saccoB.com',
        saccoId: 'sacco_B',
        role: 'sacco_manager',
      });
    });

    const managerA = testEnv.authenticatedContext('mgr_a', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });

    // 1. Manager A can create a team_user for sacco_A
    await assertSucceeds(
      setDoc(doc(managerA.firestore(), 'team_users/user_A_new'), {
        email: 'new@saccoA.com',
        saccoId: 'sacco_A',
        role: 'sacco_manager',
      })
    );

    // 2. Manager A cannot create a team_user for sacco_B
    await assertFails(
      setDoc(doc(managerA.firestore(), 'team_users/user_B_spoof'), {
        email: 'new@saccoB.com',
        saccoId: 'sacco_B',
        role: 'sacco_manager',
      })
    );

    // 3. Manager A can read own sacco_A team_user
    await assertSucceeds(getDoc(doc(managerA.firestore(), 'team_users/user_A')));

    // 4. Manager A cannot read cross-tenant sacco_B team_user
    await assertFails(getDoc(doc(managerA.firestore(), 'team_users/user_B')));
  });

  it('SEC-007: non-admin client write/read to processedEvents is denied', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'processedEvents/event_123'), {
        eventId: 'event_123',
        handler: 'computeVehicleRisk',
      });
    });

    const passenger = testEnv.authenticatedContext('passenger_1', { activeRole: 'passenger' });
    const admin = testEnv.authenticatedContext('admin_1', { activeRole: 'admin' });

    // 1. Client write to processedEvents is denied
    await assertFails(
      setDoc(doc(passenger.firestore(), 'processedEvents/event_new'), {
        eventId: 'event_new',
        handler: 'computeVehicleRisk',
      })
    );

    // 2. Non-admin read to processedEvents is denied
    await assertFails(getDoc(doc(passenger.firestore(), 'processedEvents/event_123')));

    // 3. Admin read to processedEvents succeeds
    await assertSucceeds(getDoc(doc(admin.firestore(), 'processedEvents/event_123')));
  });

  it('BE-001 / SEC-004: suspended user with isSuspended claim is denied Firestore writes', async () => {
    const activePassenger = testEnv.authenticatedContext('user_active_1', {
      activeRole: 'passenger',
      isSuspended: false,
    });
    await assertSucceeds(
      setDoc(doc(activePassenger.firestore(), 'complaints/complaint_101'), {
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

    const suspendedPassenger = testEnv.authenticatedContext('user_suspended_1', {
      activeRole: 'passenger',
      isSuspended: true,
    });
    await assertFails(
      setDoc(doc(suspendedPassenger.firestore(), 'complaints/complaint_102'), {
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
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users/passenger_A'), {
        uid: 'passenger_A',
        displayName: 'Alice',
        phoneNumber: '+254711111111',
        role: 'passenger',
      });
      await setDoc(doc(db, 'users/passenger_B'), {
        uid: 'passenger_B',
        displayName: 'Bob',
        phoneNumber: '+254722222222',
        role: 'passenger',
      });
      await setDoc(doc(db, 'users/sacco_user_A'), {
        uid: 'sacco_user_A',
        displayName: 'Driver A',
        saccoId: 'sacco_A',
      });
    });

    const passengerA = testEnv.authenticatedContext('passenger_A', { activeRole: 'passenger' });
    const adminUser = testEnv.authenticatedContext('admin_1', { activeRole: 'admin' });
    const saccoManagerA = testEnv.authenticatedContext('mgr_a', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });

    // 1. Passenger A can read own profile
    await assertSucceeds(getDoc(doc(passengerA.firestore(), 'users/passenger_A')));

    // 2. Passenger A CANNOT read Passenger B profile
    await assertFails(getDoc(doc(passengerA.firestore(), 'users/passenger_B')));

    // 3. Admin can read anyone's profile
    await assertSucceeds(getDoc(doc(adminUser.firestore(), 'users/passenger_A')));
    await assertSucceeds(getDoc(doc(adminUser.firestore(), 'users/passenger_B')));

    // 4. SACCO Manager A can read user in sacco_A
    await assertSucceeds(getDoc(doc(saccoManagerA.firestore(), 'users/sacco_user_A')));

    // 5. SACCO Manager A CANNOT read Passenger B (not in sacco_A)
    await assertFails(getDoc(doc(saccoManagerA.firestore(), 'users/passenger_B')));
  });

  it('VT-003: trips and violations create rules reject implausible coordinates, future timestamps, and excessive speeds', async () => {
    const passenger = testEnv.authenticatedContext('passenger_vt3', {
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
      setDoc(doc(passenger.firestore(), 'trips/trip_out_of_kenya'), {
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
      setDoc(doc(passenger.firestore(), 'trips/trip_startloc_bad'), {
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
      setDoc(doc(passenger.firestore(), 'trips/trip_malformed_coords'), {
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
      setDoc(doc(passenger.firestore(), 'trips/trip_future_time'), {
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
      setDoc(doc(passenger.firestore(), 'trips/trip_too_old_time'), {
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
      setDoc(doc(passenger.firestore(), 'trips/trip_iso_string_time'), {
        id: 'trip_iso_string_time',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        saccoName: 'SACCO A',
        routeName: 'Nairobi - Thika',
        status: 'active',
        latitude: -1.286389,
        longitude: 36.817223,
        startTime: isoStringTime as any,
      })
    );

    // 7. Trip with negative speed -> FAILS
    await assertFails(
      setDoc(doc(passenger.firestore(), 'trips/trip_negative_speed'), {
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
      setDoc(doc(passenger.firestore(), 'trips/trip_excessive_speed'), {
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
      setDoc(doc(passenger.firestore(), 'violations/viol_out_of_kenya'), {
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
      setDoc(doc(passenger.firestore(), 'violations/viol_malformed_coords'), {
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
      setDoc(doc(passenger.firestore(), 'violations/viol_future_time'), {
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
      setDoc(doc(passenger.firestore(), 'violations/viol_too_old_time'), {
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
      setDoc(doc(passenger.firestore(), 'violations/viol_iso_string_time'), {
        id: 'viol_iso_string_time',
        userId: 'passenger_vt3',
        vehicleRegNumber: 'KCA 111A',
        saccoId: 'sacco_A',
        recordedSpeedKmH: 95,
        speedLimitKmH: 80,
        timestamp: isoStringTime as any,
      })
    );

    // 14. Violation with physically impossible speed (> 180 km/h) -> FAILS
    await assertFails(
      setDoc(doc(passenger.firestore(), 'violations/viol_impossible_speed'), {
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
      setDoc(doc(passenger.firestore(), 'violations/viol_negative_speed'), {
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
      setDoc(doc(passenger.firestore(), 'trips/trip_valid_kenya'), {
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

    // 16b. MED-04: Trip with endTime one year in future -> FAILS
    const futureEndTime = Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    await assertFails(
      updateDoc(doc(passenger.firestore(), 'trips/trip_valid_kenya'), {
        endTime: futureEndTime,
        status: 'completed',
      })
    );

    // 16c. MED-04: Trip with valid plausible endTime -> SUCCEEDS
    const validEndTime = Timestamp.fromDate(new Date(Date.now() + 60 * 1000)); // +1 min within plausibility
    await assertSucceeds(
      updateDoc(doc(passenger.firestore(), 'trips/trip_valid_kenya'), {
        endTime: validEndTime,
        status: 'completed',
      })
    );

    // 17. Legitimate Violation within Kenya bounds and valid Timestamp -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(passenger.firestore(), 'violations/viol_valid_kenya'), {
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
    const saccoAManager = testEnv.authenticatedContext('sacco_mgr_A', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_A',
    });
    const saccoBManager = testEnv.authenticatedContext('sacco_mgr_B', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_B',
    });
    const passenger = testEnv.authenticatedContext('passenger_user_1', {
      activeRole: 'passenger',
    });
    const driver = testEnv.authenticatedContext('driver_user_1', {
      activeRole: 'driver',
    });
    const admin = testEnv.authenticatedContext('admin_user_1', {
      activeRole: 'admin',
    });
    const unauth = testEnv.unauthenticatedContext();

    // 1. SACCO A manager writing SACCO A counter -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(saccoAManager.firestore(), 'saccoCounters/sacco_A_trips_shard_0'), {
        count: 5,
        saccoId: 'sacco_A',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );

    // 2. SACCO A manager reading SACCO A counter -> SUCCEEDS
    await assertSucceeds(
      getDoc(doc(saccoAManager.firestore(), 'saccoCounters/sacco_A_trips_shard_0'))
    );

    // 3. SACCO A manager attempting to write SACCO B counter -> FAILS (Cross-tenant forbidden)
    await assertFails(
      setDoc(doc(saccoAManager.firestore(), 'saccoCounters/sacco_B_trips_shard_0'), {
        count: 10,
        saccoId: 'sacco_B',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );

    // 4. SACCO B manager attempting to read SACCO A counter -> FAILS
    await assertFails(
      getDoc(doc(saccoBManager.firestore(), 'saccoCounters/sacco_A_trips_shard_0'))
    );

    // 5. Passenger attempting any write to saccoCounters -> FAILS (No isSignedIn catch-all)
    await assertFails(
      setDoc(doc(passenger.firestore(), 'saccoCounters/sacco_A_trips_shard_0'), {
        count: 999,
        saccoId: 'sacco_A',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );

    // 6. Passenger attempting any read to saccoCounters -> FAILS
    await assertFails(
      getDoc(doc(passenger.firestore(), 'saccoCounters/sacco_A_trips_shard_0'))
    );

    // 7. Driver attempting any write to saccoCounters -> FAILS
    await assertFails(
      setDoc(doc(driver.firestore(), 'saccoCounters/sacco_A_trips_shard_0'), {
        count: 1,
        saccoId: 'sacco_A',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );

    // 8. Unauthenticated user attempting any write or read -> FAILS
    await assertFails(
      setDoc(doc(unauth.firestore(), 'saccoCounters/sacco_A_trips_shard_0'), {
        count: 1,
        saccoId: 'sacco_A',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );
    await assertFails(
      getDoc(doc(unauth.firestore(), 'saccoCounters/sacco_A_trips_shard_0'))
    );

    // 9. Admin writing counters -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(admin.firestore(), 'saccoCounters/sacco_B_trips_shard_0'), {
        count: 20,
        saccoId: 'sacco_B',
        metric: 'trips',
        shardId: 0,
        updatedAt: new Date().toISOString(),
      })
    );
  });

  it('CRIT-04: Black spots geographic bounds validation and strict moderation field protection', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'black_spots/existing_spot_1'), {
        id: 'existing_spot_1',
        reportedByUid: 'passenger_author',
        title: 'Dangerous Pothole',
        description: 'Large pothole on lane 2',
        hazardType: 'pothole',
        severity: 'high',
        locationName: 'Waiyaki Way',
        latitude: -1.286389,
        longitude: 36.817223,
        location: { lat: -1.286389, lng: 36.817223 },
        status: 'pending',
        verifiedByAuthority: false,
        confidenceScore: 0.5,
        corroborationsCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    const author = testEnv.authenticatedContext('passenger_author', {
      activeRole: 'passenger',
      firebase: { sign_in_provider: 'password' },
    });
    const otherPassenger = testEnv.authenticatedContext('other_passenger', {
      activeRole: 'passenger',
      firebase: { sign_in_provider: 'password' },
    });
    const authority = testEnv.authenticatedContext('ntsa_officer', {
      activeRole: 'authority',
      saccoId: 'NTSA',
      firebase: { sign_in_provider: 'password' },
    });
    const admin = testEnv.authenticatedContext('system_admin', {
      activeRole: 'admin',
      firebase: { sign_in_provider: 'password' },
    });

    // 1. Create with valid Kenya coordinates -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(author.firestore(), 'black_spots/new_spot_valid'), {
        id: 'new_spot_valid',
        reportedByUid: 'passenger_author',
        title: 'Unmarked Bump',
        hazardType: 'unmarked_bump',
        latitude: -1.2921,
        longitude: 36.8219,
        location: { lat: -1.2921, lng: 36.8219 },
        status: 'pending',
        verifiedByAuthority: false,
        createdAt: new Date().toISOString(),
      })
    );

    // 2. Create with out-of-bounds coordinates (e.g. Paris / Outside Kenya) -> FAILS
    await assertFails(
      setDoc(doc(author.firestore(), 'black_spots/new_spot_invalid_geo'), {
        id: 'new_spot_invalid_geo',
        reportedByUid: 'passenger_author',
        title: 'Fake Foreign Spot',
        hazardType: 'pothole',
        latitude: 48.8566,
        longitude: 2.3522,
        createdAt: new Date().toISOString(),
      })
    );

    // 3. Create with invalid location map out-of-bounds -> FAILS
    await assertFails(
      setDoc(doc(author.firestore(), 'black_spots/new_spot_invalid_map_geo'), {
        id: 'new_spot_invalid_map_geo',
        reportedByUid: 'passenger_author',
        title: 'Invalid Map Spot',
        hazardType: 'pothole',
        location: { lat: 51.5074, lng: -0.1278 },
        createdAt: new Date().toISOString(),
      })
    );

    // 4. Passenger attempting to self-verify on create -> FAILS
    await assertFails(
      setDoc(doc(author.firestore(), 'black_spots/new_spot_spoof_verified'), {
        id: 'new_spot_spoof_verified',
        reportedByUid: 'passenger_author',
        title: 'Self Verified Spot',
        hazardType: 'pothole',
        latitude: -1.286389,
        longitude: 36.817223,
        verifiedByAuthority: true,
        status: 'published',
        createdAt: new Date().toISOString(),
      })
    );

    // 5. Reporter updating descriptive safe fields -> SUCCEEDS
    await assertSucceeds(
      updateDoc(doc(author.firestore(), 'black_spots/existing_spot_1'), {
        title: 'Updated Pothole Hazard',
        description: 'Extended trench near bus stop',
        hazardDescription: 'Deep trench',
        hazardType: 'pothole',
        locationName: 'Waiyaki Way near Stage',
        updatedAt: new Date().toISOString(),
      })
    );

    // 6. Reporter attempting to self-publish or self-verify (moderation tamper) -> FAILS
    await assertFails(
      updateDoc(doc(author.firestore(), 'black_spots/existing_spot_1'), {
        status: 'published',
      })
    );
    await assertFails(
      updateDoc(doc(author.firestore(), 'black_spots/existing_spot_1'), {
        verifiedByAuthority: true,
      })
    );
    await assertFails(
      updateDoc(doc(author.firestore(), 'black_spots/existing_spot_1'), {
        confidenceScore: 0.99,
      })
    );
    await assertFails(
      updateDoc(doc(author.firestore(), 'black_spots/existing_spot_1'), {
        corroborationsCount: 50,
      })
    );

    // 7. Other passenger attempting to edit author's report -> FAILS
    await assertFails(
      updateDoc(doc(otherPassenger.firestore(), 'black_spots/existing_spot_1'), {
        description: 'Unauthorized edit',
      })
    );

    // 8. Authority verifying and publishing black spot -> SUCCEEDS
    await assertSucceeds(
      updateDoc(doc(authority.firestore(), 'black_spots/existing_spot_1'), {
        status: 'published',
        verifiedByAuthority: true,
        confidenceScore: 0.95,
        updatedAt: new Date().toISOString(),
      })
    );

    // 9. Admin deleting black spot -> SUCCEEDS
    await assertSucceeds(
      deleteDoc(doc(admin.firestore(), 'black_spots/existing_spot_1'))
    );
  });

  it('HIGH-03: SACCO manager cannot rewrite status or safetyScore, but admin can update status and manager can update allowed profile fields', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'saccos/sacco_suspended_1'), {
        id: 'sacco_suspended_1',
        name: 'Matatu Safaris Ltd',
        registrationCode: 'NTSA/SACCO/2024/099',
        fleetCount: 20,
        safetyScore: 65,
        contactPhone: '+254700000001',
        contactEmail: 'info@matatusafaris.co.ke',
        status: 'suspended',
        settings: { notifications: true },
      });
    });

    const saccoManager = testEnv.authenticatedContext('manager_user_1', {
      activeRole: 'sacco_manager',
      saccoId: 'sacco_suspended_1',
      firebase: { sign_in_provider: 'password' },
    });

    const admin = testEnv.authenticatedContext('admin_user_1', {
      activeRole: 'admin',
      firebase: { sign_in_provider: 'password' },
    });

    const authority = testEnv.authenticatedContext('authority_user_1', {
      activeRole: 'authority',
      saccoId: 'NTSA',
      firebase: { sign_in_provider: 'password' },
    });

    // 1. SACCO-manager attempts to rewrite status from 'suspended' to 'active' -> FAILS
    await assertFails(
      updateDoc(doc(saccoManager.firestore(), 'saccos/sacco_suspended_1'), {
        status: 'active',
      })
    );

    // 2. SACCO-manager attempts to rewrite status to 'under_review' -> FAILS
    await assertFails(
      updateDoc(doc(saccoManager.firestore(), 'saccos/sacco_suspended_1'), {
        status: 'under_review',
      })
    );

    // 3. SACCO-manager attempts to rewrite safetyScore -> FAILS
    await assertFails(
      updateDoc(doc(saccoManager.firestore(), 'saccos/sacco_suspended_1'), {
        safetyScore: 99,
      })
    );

    // 4. SACCO-manager updating allowed fields (contactEmail, contactPhone, settings, updatedAt) -> SUCCEEDS
    await assertSucceeds(
      updateDoc(doc(saccoManager.firestore(), 'saccos/sacco_suspended_1'), {
        contactEmail: 'contact@matatusafaris.co.ke',
        contactPhone: '+254711222333',
        settings: { notifications: false },
        updatedAt: new Date().toISOString(),
      })
    );

    // 5. Admin updating status (e.g. approving/reactivating SACCO) -> SUCCEEDS
    await assertSucceeds(
      updateDoc(doc(admin.firestore(), 'saccos/sacco_suspended_1'), {
        status: 'active',
      })
    );

    // 6. Authority updating status -> SUCCEEDS
    await assertSucceeds(
      updateDoc(doc(authority.firestore(), 'saccos/sacco_suspended_1'), {
        status: 'under_review',
      })
    );
  });

  it('HIGH-04: audit_logs create rule validates saccoId ownership for sacco_manager writes, while admin/authority can write across tenants', async () => {
    const saccoAManager = testEnv.authenticatedContext('manager_sacco_a', {
      activeRole: 'sacco_manager',
      saccoId: 'SACCO-A',
      firebase: { sign_in_provider: 'password' },
    });

    const admin = testEnv.authenticatedContext('admin_user', {
      activeRole: 'admin',
      firebase: { sign_in_provider: 'password' },
    });

    const authority = testEnv.authenticatedContext('ntsa_officer', {
      activeRole: 'authority',
      saccoId: 'NTSA',
      firebase: { sign_in_provider: 'password' },
    });

    // 1. SACCO-A manager creates an audit log with saccoId: 'SACCO-B' (spoofing other tenant) -> FAILS
    await assertFails(
      setDoc(doc(saccoAManager.firestore(), 'audit_logs/log_spoofed_b'), {
        id: 'log_spoofed_b',
        saccoId: 'SACCO-B',
        actorName: 'SACCO-A Manager',
        actorRole: 'sacco_manager',
        action: 'DELETE_VEHICLE',
        target: 'KDA 123X',
        timestamp: new Date().toISOString(),
      })
    );

    // 2. SACCO-A manager creates an audit log with incorrect actorRole -> FAILS
    await assertFails(
      setDoc(doc(saccoAManager.firestore(), 'audit_logs/log_spoofed_role'), {
        id: 'log_spoofed_role',
        saccoId: 'SACCO-A',
        actorName: 'SACCO-A Manager',
        actorRole: 'admin',
        action: 'SYSTEM_CONFIG',
        target: 'Config',
        timestamp: new Date().toISOString(),
      })
    );

    // 3. SACCO-A manager creates an audit log for their own SACCO ('SACCO-A') -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(saccoAManager.firestore(), 'audit_logs/log_valid_a'), {
        id: 'log_valid_a',
        saccoId: 'SACCO-A',
        actorName: 'SACCO-A Manager',
        actorRole: 'sacco_manager',
        action: 'CLAIM_PROVISIONAL_VEHICLE',
        target: 'KDA 771B',
        timestamp: new Date().toISOString(),
      })
    );

    // 4. Admin creates an audit log with any saccoId -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(admin.firestore(), 'audit_logs/log_admin_any'), {
        id: 'log_admin_any',
        saccoId: 'SACCO-B',
        actorName: 'System Admin',
        actorRole: 'admin',
        action: 'APPROVE_SACCO_VERIFICATION',
        target: 'SACCO-B',
        timestamp: new Date().toISOString(),
      })
    );

    // 5. Authority creates an audit log with any saccoId -> SUCCEEDS
    await assertSucceeds(
      setDoc(doc(authority.firestore(), 'audit_logs/log_authority_any'), {
        id: 'log_authority_any',
        saccoId: 'SACCO-C',
        actorName: 'NTSA Officer',
        actorRole: 'authority',
        action: 'SUSPEND_SACCO_FLEET',
        target: 'SACCO-C',
        timestamp: new Date().toISOString(),
      })
    );

    // 6. Append-only guarantee: update and delete remain blocked
    await assertFails(
      updateDoc(doc(admin.firestore(), 'audit_logs/log_valid_a'), {
        action: 'TAMPERED_ACTION',
      })
    );
    await assertFails(
      deleteDoc(doc(admin.firestore(), 'audit_logs/log_valid_a'))
    );
  });
});
