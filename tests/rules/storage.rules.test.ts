// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';

const PROJECT_ID = 'demo-mwendo-salama-rules';
const STORAGE_BUCKET = `${PROJECT_ID}.appspot.com`;
const STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199';

let testEnv: RulesTestEnvironment | null = null;
let emulatorOnline = false;

function claims(activeRole: string, saccoId?: string) {
  return {
    activeRole,
    firebase: { sign_in_provider: 'custom' },
    ...(saccoId ? { saccoId } : {}),
  };
}

beforeAll(async () => {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  try {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: {
        host: STORAGE_EMULATOR_HOST.split(':')[0],
        port: Number(STORAGE_EMULATOR_HOST.split(':')[1] ?? 9199),
        rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
      },
      firestore: {
        host: firestoreHost.split(':')[0],
        port: Number(firestoreHost.split(':')[1] ?? 8080),
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      },
    });
    emulatorOnline = true;
  } catch (err: any) {
    const isOfflineOrNginx =
      typeof err?.message === 'string' &&
      (err.message.includes('405') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('Not Allowed'));
    if (isOfflineOrNginx) {
      console.info(
        `[storage.rules.test] Storage/Firestore emulator not active. Tests skipped gracefully.`
      );
    } else {
      console.warn('[storage.rules.test] Failed to initialize test environment:', err);
    }
  }
});

afterEach(async () => {
  if (testEnv) {
    await testEnv.clearStorage();
    await testEnv.clearFirestore();
  }
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe('Storage security rules', () => {
  beforeEach((ctx) => {
    if (!emulatorOnline || !testEnv) {
      ctx.skip();
    }
  });
  it('denies unauthenticated avatar reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const unauthenticated = testEnv.unauthenticatedContext();
    await assertFails(getBytes(ref(unauthenticated.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg')));
  });

  it('allows an authenticated user to read an avatar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const authenticated = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertSucceeds(getBytes(ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg')));
  });

  it('allows an avatar owner to upload a valid image', async () => {
    const authenticated = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertSucceeds(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
      ),
    );
  });

  it('denies an authenticated user from writing another user avatar', async () => {
    const authenticated = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertFails(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
      ),
    );
  });

  it('denies avatar uploads with a non-image content type', async () => {
    const authenticated = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertFails(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.txt'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'text/plain' },
      ),
    );
  });

  it('denies avatar uploads at the 2MB size boundary', async () => {
    const authenticated = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertFails(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg'),
        new Uint8Array(2 * 1024 * 1024),
        { contentType: 'image/jpeg' },
      ),
    );
  });

  it('denies unauthenticated black-spot evidence reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const unauthenticated = testEnv.unauthenticatedContext();
    await assertFails(getBytes(ref(unauthenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg')));
  });

  it('allows the black-spot reporter to read their evidence', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const reporter = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertSucceeds(getBytes(ref(reporter.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg')));
  });

  it('denies a different passenger from reading black-spot evidence', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const authenticated = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertFails(getBytes(ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg')));
  });

  it('denies a reporter from reading evidence through a spoofed UID path', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-2/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const user2 = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertFails(getBytes(ref(user2.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-2/evidence.jpg')));
  });

  it('allows the black-spot reporter to upload evidence', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
    });

    const authenticated = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertSucceeds(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
      ),
    );
  });

  it('denies a different passenger from uploading black-spot evidence', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
    });

    const authenticated = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertFails(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
      ),
    );
  });

  it('denies black-spot evidence uploads with a non-image content type', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
    });

    const authenticated = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertFails(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.txt'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'text/plain' },
      ),
    );
  });

  it('denies black-spot evidence uploads at the 5MB size boundary', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
    });

    const authenticated = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertFails(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'),
        new Uint8Array(5 * 1024 * 1024),
        { contentType: 'image/jpeg' },
      ),
    );
  });

  it('allows a SACCO manager to read evidence for their SACCO complaint only', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('complaints/complaint-1').set({
        reportedByUid: 'passenger-1',
        saccoId: 'sacco-a',
      });
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'evidence/sacco-a/complaint-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'evidence/sacco-b/complaint-2/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const manager = testEnv.authenticatedContext('manager-a', claims('sacco_manager', 'sacco-a'));
    await assertSucceeds(
      getBytes(ref(manager.storage(`gs://${STORAGE_BUCKET}`), 'evidence/sacco-a/complaint-1/evidence.jpg')),
    );
    await assertFails(
      getBytes(ref(manager.storage(`gs://${STORAGE_BUCKET}`), 'evidence/sacco-b/complaint-2/evidence.jpg')),
    );
  });

  it('does not allow an authenticated passenger to delete protected evidence', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc('black_spots/spot-1').set({ reportedByUid: 'user-1' });
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const passenger = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertFails(deleteObject(ref(passenger.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg')));
  });
});
