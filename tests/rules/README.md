# Firebase Security Rules Tests

This directory is reserved for Firebase Emulator Suite tests for Firestore and Storage Security Rules.

## Scope

The rules suite will verify the authorization contract independently of the React/jsdom test suite, including:

- authentication requirements;
- role-based access control;
- SACCO tenant isolation;
- document ownership;
- trip immutability;
- Firestore data validation;
- protected Storage reads and writes; and
- cross-tenant evidence access.

## Test environment

These tests must run against the Firebase Local Emulator Suite. They must never connect to the production Firebase project.

The test runner should use the Firebase Rules Unit Testing SDK (`@firebase/rules-unit-testing`) and emulator-only environment variables/configuration.

## Implementation note

Do not mix these tests into the existing jsdom/Vitest application test suite. Rules tests exercise Firebase Security Rules themselves and therefore require emulator-backed clients with explicit Auth claims.

## Current status

Scaffolding only. The dependency and runner integration will be added in the next step so that the lockfile remains authoritative and CI can use a reproducible install.
