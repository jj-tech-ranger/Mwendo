import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(() => [{ name: '[DEFAULT]' }]),
  initializeApp: vi.fn(),
  applicationDefault: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
    projectConfigManager: vi.fn(() => ({
      getProjectConfig: vi.fn().mockResolvedValue({ multiFactorConfig: { providerConfigs: [] } }),
      updateProjectConfig: vi.fn().mockResolvedValue({}),
    })),
  })),
}));

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn().mockResolvedValue({}),
      })),
    })),
  })),
  FieldValue: {
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  },
}));

describe('scripts/provision-demo-accounts.ts', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses DEMO_ADMIN_EMAIL from environment when specified', async () => {
    process.env.DEMO_ADMIN_EMAIL = 'custom-admin@mwendo-test.ke';
    process.env.NODE_ENV = 'test';

    const { DEMO_ACCOUNTS } = await import('../../scripts/provision-demo-accounts');
    expect(DEMO_ACCOUNTS.admin.email).toBe('custom-admin@mwendo-test.ke');
  });

  it('falls back to admin@example.com in test or emulator mode when DEMO_ADMIN_EMAIL is unset', async () => {
    delete process.env.DEMO_ADMIN_EMAIL;
    delete process.env.MWENDO_DEMO_ADMIN_EMAIL;
    process.env.NODE_ENV = 'test';

    const { DEMO_ACCOUNTS } = await import('../../scripts/provision-demo-accounts');
    expect(DEMO_ACCOUNTS.admin.email).toBe('admin@example.com');
  });

  it('throws an error in production when DEMO_ADMIN_EMAIL is not provided to prevent silent fallback', async () => {
    delete process.env.DEMO_ADMIN_EMAIL;
    delete process.env.MWENDO_DEMO_ADMIN_EMAIL;
    delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.MWENDO_E2E;
    process.env.NODE_ENV = 'production';
    process.env.GCLOUD_PROJECT = 'mwendo-salama-prod';

    await expect(async () => {
      await import('../../scripts/provision-demo-accounts');
    }).rejects.toThrow(/Missing required environment variable: DEMO_ADMIN_EMAIL/);
  });
});
