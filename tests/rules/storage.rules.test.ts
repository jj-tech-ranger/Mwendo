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

let testEnv: RulesTestEnvironment;

function claims(activeRole: string, saccoId?: string) {
  return {
    activeRole,
    firebase: { sign_in_provider: 'custom' },
    ...(saccoId ? { saccoId } : {}),
  };
}

beforeAll(async () => {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
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
});

afterEach(async () => {
  await testEnv.clearStorage();
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Storage security rules', () => {
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

  it('denies unauthenticated black-spot evidence reads', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const unauthenticated = testEnv.unauthenticatedContext();
    await assertFails(getBytes(ref(unauthenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg')));
  });

  it('allows an authenticated user to read black-spot evidence under the current policy', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const authenticated = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertSucceeds(getBytes(ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg')));
  });

  it('allows the black-spot reporter to upload evidence', async () => {
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
    const authenticated = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertFails(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'),
        new Uint8Array([1, 2, 3]),
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
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const passenger = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertFails(deleteObject(ref(passenger.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/user-1/evidence.jpg')));
  });
});
