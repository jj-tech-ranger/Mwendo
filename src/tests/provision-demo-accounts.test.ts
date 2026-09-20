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
    process.env = { ...originalEnv, NODE_ENV: 'test' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses MWENDO_DEMO_ADMIN_EMAIL from environment when specified', async () => {
    process.env.MWENDO_DEMO_ADMIN_EMAIL = 'custom-admin@mwendo-test.ke';

    const { DEMO_ACCOUNTS } = await import('../../scripts/provision-demo-accounts');
    expect(DEMO_ACCOUNTS.admin.email).toBe('custom-admin@mwendo-test.ke');
  });

  it('falls back to admin.demo@mwendo-salama.test when MWENDO_DEMO_ADMIN_EMAIL is unset', async () => {
    delete process.env.MWENDO_DEMO_ADMIN_EMAIL;

    const { DEMO_ACCOUNTS } = await import('../../scripts/provision-demo-accounts');
    expect(DEMO_ACCOUNTS.admin.email).toBe('admin.demo@mwendo-salama.test');
  });
});
