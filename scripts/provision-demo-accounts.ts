import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'mwendo-salama-prod';
const DEMO_SACCO_ID = 'demo-sacco-mwendo';
const ADMIN_EMAIL = 'jemutaijemimah@gmail.com';

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const DEMO_ACCOUNTS = {
  admin: {
    email: ADMIN_EMAIL,
    password: requiredSecret('MWENDO_DEMO_ADMIN_PASSWORD'),
    displayName: 'Mwendo Salama Administrator',
  },
  sacco: {
    email: process.env.MWENDO_DEMO_SACCO_EMAIL || 'sacco.demo@mwendo-salama.test',
    password: requiredSecret('MWENDO_DEMO_SACCO_PASSWORD'),
    displayName: 'Mwendo Demo SACCO Manager',
  },
  authority: {
    email: process.env.MWENDO_DEMO_AUTHORITY_EMAIL || 'ntsa.demo@mwendo-salama.test',
    password: requiredSecret('MWENDO_DEMO_AUTHORITY_PASSWORD'),
    displayName: 'Mwendo Demo NTSA Inspector',
  },
} as const;

if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const auth = getAuth();
const db = getFirestore();

async function upsertAuthUser(email: string, password: string, displayName: string): Promise<UserRecord> {
  try {
    const existing = await auth.getUserByEmail(email);
    return auth.updateUser(existing.uid, {
      password,
      displayName,
      disabled: false,
      emailVerified: true,
    });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'auth/user-not-found') {
      return auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
        disabled: false,
      });
    }
    throw error;
  }
}

async function writeUserProfile(
  user: UserRecord,
  role: 'admin' | 'sacco_manager' | 'authority',
  claims: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const now = new Date().toISOString();

  await db.collection('users').doc(user.uid).set(
    {
      id: user.uid,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role,
      activeRole: role,
      claimedActiveRole: role,
      claims,
      isVerified: true,
      isActive: true,
      isMfaEnrolled: false,
      isMfaVerified: false,
      isAnonymous: false,
      termsAccepted: true,
      privacyPolicyVersion: '2026-01',
      ageConfirmed: true,
      analyticsConsent: false,
      language: 'en',
      createdAt: now,
      updatedAt: now,
      ...extra,
    },
    { merge: true },
  );
}

async function provision(): Promise<void> {
  console.log(`Provisioning Mwendo Salama demo accounts in ${PROJECT_ID}...`);

  const adminUser = await upsertAuthUser(
    DEMO_ACCOUNTS.admin.email,
    DEMO_ACCOUNTS.admin.password,
    DEMO_ACCOUNTS.admin.displayName,
  );
  await auth.setCustomUserClaims(adminUser.uid, {
    activeRole: 'admin',
    isSuspended: false,
  });
  await writeUserProfile(adminUser, 'admin', {
    activeRole: 'admin',
    isSuspended: false,
  });

  await db.collection('saccos').doc(DEMO_SACCO_ID).set(
    {
      id: DEMO_SACCO_ID,
      name: 'Mwendo Demo SACCO',
      registrationCode: 'DEMO-SACCO-001',
      fleetCount: 0,
      safetyScore: 100,
      contactPhone: '+254700000001',
      contactEmail: DEMO_ACCOUNTS.sacco.email,
      status: 'active',
      county: 'Nairobi',
      isDemo: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const saccoUser = await upsertAuthUser(
    DEMO_ACCOUNTS.sacco.email,
    DEMO_ACCOUNTS.sacco.password,
    DEMO_ACCOUNTS.sacco.displayName,
  );
  await auth.setCustomUserClaims(saccoUser.uid, {
    activeRole: 'sacco_manager',
    saccoId: DEMO_SACCO_ID,
    isSuspended: false,
  });
  await writeUserProfile(
    saccoUser,
    'sacco_manager',
    {
      activeRole: 'sacco_manager',
      saccoId: DEMO_SACCO_ID,
      isSuspended: false,
    },
    {
      saccoId: DEMO_SACCO_ID,
      claimedSaccoId: DEMO_SACCO_ID,
    },
  );

  const authorityUser = await upsertAuthUser(
    DEMO_ACCOUNTS.authority.email,
    DEMO_ACCOUNTS.authority.password,
    DEMO_ACCOUNTS.authority.displayName,
  );
  await auth.setCustomUserClaims(authorityUser.uid, {
    activeRole: 'authority',
    authorityScope: 'national',
    isSuspended: false,
  });
  await writeUserProfile(
    authorityUser,
    'authority',
    {
      activeRole: 'authority',
      authorityScope: 'national',
      isSuspended: false,
    },
    {
      authorityId: 'demo-ntsa',
      authorityScope: 'national',
      claimedAuthorityScope: 'national',
      badgeNumber: 'DEMO-NTSA-001',
      county: 'Nairobi',
    },
  );

  console.log('\nDemo accounts provisioned successfully.\n');
  console.table([
    {
      role: 'admin',
      email: DEMO_ACCOUNTS.admin.email,
      uid: adminUser.uid,
    },
    {
      role: 'sacco_manager',
      email: DEMO_ACCOUNTS.sacco.email,
      uid: saccoUser.uid,
      saccoId: DEMO_SACCO_ID,
    },
    {
      role: 'authority / NTSA',
      email: DEMO_ACCOUNTS.authority.email,
      uid: authorityUser.uid,
      authorityScope: 'national',
    },
  ]);

  console.log('\nPasswords are intentionally not printed or stored in the repository.');
}

provision().catch((error: unknown) => {
  console.error('Failed to provision Mwendo demo accounts:', error);
  process.exitCode = 1;
});
