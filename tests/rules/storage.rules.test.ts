import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

// Storage Security Rules evaluate firestore.get()/exists() against the
// Firestore emulator's shared backend. @firebase/rules-unit-testing's Firestore
// context can be isolated from the Storage rules runtime for this cross-service
// lookup, so seed these documents with the Admin SDK. FIRESTORE_EMULATOR_HOST is
// set by `firebase emulators:exec`, keeping this strictly inside the emulator.
function adminFirestore() {
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  return getFirestore(app);
}

async function seedFirestoreDocument(path: string, data: Record<string, unknown>) {
  await adminFirestore().doc(path).set(data);
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      host: STORAGE_EMULATOR_HOST.split(':')[0],
      port: Number(STORAGE_EMULATOR_HOST.split(':')[1] ?? 9199),
      rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
    },
    firestore: {
      host: (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')[0],
      port: Number((process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':')[1] ?? 8080),
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
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const unauthenticated = testEnv.unauthenticatedContext();
    await assertFails(getBytes(ref(unauthenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/evidence.jpg')));
  });

  it('allows an authenticated user to read black-spot evidence under the current policy', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const authenticated = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertSucceeds(getBytes(ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/evidence.jpg')));
  });

  it('allows the black-spot reporter to upload evidence', async () => {
    await seedFirestoreDocument('black_spots/spot-1', { reportedByUid: 'user-1' });

    const authenticated = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertSucceeds(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/evidence.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
      ),
    );
  });

  it('denies a different passenger from uploading black-spot evidence', async () => {
    await seedFirestoreDocument('black_spots/spot-1', { reportedByUid: 'user-1' });

    const authenticated = testEnv.authenticatedContext('user-2', claims('passenger'));
    await assertFails(
      uploadBytes(
        ref(authenticated.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/evidence.jpg'),
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
      await uploadBytes(ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/evidence.jpg'), new Uint8Array([1, 2, 3]), {
        contentType: 'image/jpeg',
      });
    });

    const passenger = testEnv.authenticatedContext('user-1', claims('passenger'));
    await assertFails(deleteObject(ref(passenger.storage(`gs://${STORAGE_BUCKET}`), 'black_spots/spot-1/evidence.jpg')));
  });
});
