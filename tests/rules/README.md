# Firebase Security Rules Tests

These tests exercise Firebase Security Rules against the Local Emulator Suite. They are intentionally separate from the React/jsdom application test suite.

## Scope

The suite covers:

- authentication requirements;
- custom-claim role authorization;
- SACCO tenant isolation;
- document ownership;
- trip immutability;
- Firestore data validation; and
- protected Storage reads and writes.

## Safety boundary

The Rules suite must run only against emulator project `demo-mwendo-salama-rules`. It must never connect to the production Firebase project.

## Run

```bash
npm run test:rules
```

The command starts Firestore and Storage emulators, loads the repository Rules files, runs the Rules tests with the Node environment, and shuts the emulators down when complete.

## Policy note

Black-spot evidence is currently readable by any authenticated user because that is the current Storage Rules policy. The corresponding test deliberately documents that behaviour. If product policy changes to reporter-only, SACCO-scoped, authority-only, or another access model, update both the Rules and this test together.
