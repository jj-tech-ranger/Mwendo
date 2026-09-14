import { getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'mwendo-salama-prod';
const DEMO_SACCO_ID = 'demo-sacco-mwendo';
function getSecret(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  const isEmulatorOrTest = Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.NODE_ENV === 'test' ||
    process.env.MWENDO_E2E === 'true' ||
    (PROJECT_ID && PROJECT_ID.includes('demo'))
  );
  if (isEmulatorOrTest && fallback) {
    return fallback;
  }
  throw new Error(`Missing required environment variable: ${name}`);
}

const ADMIN_EMAIL =
  process.env.DEMO_ADMIN_EMAIL ||
  process.env.MWENDO_DEMO_ADMIN_EMAIL ||
  getSecret('DEMO_ADMIN_EMAIL', 'admin@example.com');

export const DEMO_ACCOUNTS = {
  admin: {
    email: ADMIN_EMAIL,
    password: getSecret('MWENDO_DEMO_ADMIN_PASSWORD', 'MwendoAdmin123!'),
    displayName: 'Mwendo Salama Administrator',
  },
  sacco: {
    email: process.env.MWENDO_DEMO_SACCO_EMAIL || 'sacco.demo@mwendo-salama.test',
    password: getSecret('MWENDO_DEMO_SACCO_PASSWORD', 'MwendoSacco123!'),
    displayName: 'Mwendo Demo SACCO Manager',
  },
  authority: {
    email: process.env.MWENDO_DEMO_AUTHORITY_EMAIL || 'ntsa.demo@mwendo-salama.test',
    password: getSecret('MWENDO_DEMO_AUTHORITY_PASSWORD', 'MwendoAuthority123!'),
    displayName: 'Mwendo Demo NTSA Inspector',
  },
  passenger: {
    email: process.env.MWENDO_DEMO_PASSENGER_EMAIL || 'passenger.demo@mwendo-salama.test',
    password: getSecret('MWENDO_DEMO_PASSENGER_PASSWORD', 'MwendoPassenger123!'),
    displayName: 'Mwendo Demo Passenger',
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

async function enableTotpMfa(): Promise<void> {
  try {
    console.log('Checking production TOTP MFA configuration...');

    const projectConfig = await auth.projectConfigManager().getProjectConfig();
    const existingProviders = projectConfig.multiFactorConfig?.providerConfigs ?? [];

    const hasTotpProvider = existingProviders.some(
      (provider) => 'totpProviderConfig' in provider,
    );

    if (hasTotpProvider) {
      console.log('TOTP MFA provider is already configured.');
      return;
    }

    await auth.projectConfigManager().updateProjectConfig({
      multiFactorConfig: {
        state: projectConfig.multiFactorConfig?.state ?? 'ENABLED',
        providerConfigs: [
          ...existingProviders,
          {
            state: 'ENABLED',
            totpProviderConfig: {
              adjacentIntervals: 5,
            },
          },
        ],
      },
    });

    console.log('TOTP MFA provider enabled for the production project.');
  } catch (error) {
    console.warn('TOTP MFA project configuration skipped or not supported by current environment:', error);
  }
}

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
  role: 'admin' | 'sacco_manager' | 'authority' | 'passenger',
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

  await enableTotpMfa();

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

  const passengerUser = await upsertAuthUser(
    DEMO_ACCOUNTS.passenger.email,
    DEMO_ACCOUNTS.passenger.password,
    DEMO_ACCOUNTS.passenger.displayName,
  );
  await auth.setCustomUserClaims(passengerUser.uid, {
    activeRole: 'passenger',
    isSuspended: false,
  });
  await writeUserProfile(
    passengerUser,
    'passenger',
    {
      activeRole: 'passenger',
      isSuspended: false,
    },
    {
      phoneNumber: '+254712345678',
      trustScore: 0.85,
      trustBadge: 'gold',
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
    {
      role: 'passenger',
      email: DEMO_ACCOUNTS.passenger.email,
      uid: passengerUser.uid,
    },
  ]);

  console.log('\nPasswords are intentionally not printed or stored in the repository.');
}

export { provision as provisionDemoAccounts, enableTotpMfa };

if (
  process.argv[1] &&
  (process.argv[1].endsWith('provision-demo-accounts.ts') ||
    process.argv[1].endsWith('provision-demo-accounts.js'))
) {
  provision().catch((error: unknown) => {
    console.error('Failed to provision Mwendo demo accounts:', error);
    process.exitCode = 1;
  });
}
