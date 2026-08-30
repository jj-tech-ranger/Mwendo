import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getBytes, ref, uploadBytes } from 'firebase/storage';

const PROJECT_ID = 'demo-mwendo-salama-rules';
const STORAGE_BUCKET = `${PROJECT_ID}.appspot.com`;
const STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199';

let testEnv: RulesTestEnvironment;

function claims(isSuspended: boolean) {
  return {
    activeRole: 'passenger',
    isSuspended,
    firebase: { sign_in_provider: 'custom' },
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

describe('Storage suspension boundary', () => {
  it('denies a suspended user from reading an avatar', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
      );
    });

    const suspended = testEnv.authenticatedContext('user-1', claims(true));
    await assertFails(getBytes(ref(suspended.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg')));
  });

  it('denies a suspended user from uploading their own avatar', async () => {
    const suspended = testEnv.authenticatedContext('user-1', claims(true));
    await assertFails(
      uploadBytes(
        ref(suspended.storage(`gs://${STORAGE_BUCKET}`), 'avatars/user-1/avatar.jpg'),
        new Uint8Array([1, 2, 3]),
        { contentType: 'image/jpeg' },
      ),
    );
  });
});
