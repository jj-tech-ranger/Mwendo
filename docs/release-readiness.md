# Mwendo Salama Release Readiness

Updated: 2026-08-31

This document is the final validation ledger for the production-readiness programme. A check is marked **verified** only when the repository contains an automated test, CI gate, or explicit production validation supporting it. Unverified items remain release blockers until tested.

## Phase 0 — Baseline

- [x] Root dependency installation uses `bun install --frozen-lockfile`.
- [x] Root lint/typecheck is a CI quality gate.
- [x] Frontend build and bundle security audit are CI quality gates.
- [x] Functions lint/typecheck and build are CI quality gates.
- [x] Vitest is a CI quality gate.
- [x] Firestore and Storage rules tests run through `test:rules`.
- [x] Java 21 is installed for Firebase Emulator Suite tests.
- [x] Production deployment is restricted to pushes to `main` after the quality gate.
- [x] Production Firebase project, Auth domain, Storage bucket and application identifiers are checked before deployment.

## Phase 1 — Audit coverage

### Verified areas

- [x] Authentication and authorization boundaries.
- [x] Route guards and privileged access boundaries.
- [x] MFA challenge handling.
- [x] Registration consent/age controls.
- [x] Vehicle/trip risk and lifecycle validation.
- [x] GPS and location validation.
- [x] Black-spot reporting and evidence-related flows.
- [x] Emergency SOS identity/location validation.
- [x] Offline queue and retry/dead-letter behavior.
- [x] Analytics/report generation.
- [x] Accessibility checks on critical UI.
- [x] Firebase production hardening checks.

### Still requiring explicit closure

- [ ] Complete route-by-route manual/automated journey inventory.
- [x] Complete Cloud Function export inventory; trigger/security/failure/idempotency evidence remains attached per function in `docs/cloud-functions-inventory.md`.
- [ ] Complete Firestore index/query inventory.
- [ ] Complete production dependency inventory (Maps, reCAPTCHA, FCM/VAPID, authorized domains).

## Phase 2 — Authentication & lifecycle

- [x] Authorization claims fail closed when claims disappear.
- [x] Local active-role state is cleared when authoritative claims are absent.
- [x] Required display role is preserved separately from stale authorization state.
- [x] Suspension/reactivation behavior is covered by Functions tests.
- [x] Cross-role route protection is covered by route-guard tests.
- [ ] Full passenger registration → login → recovery → profile journey against Firebase emulator.
- [ ] Full SACCO manager authentication → tenant access journey against Firebase emulator.
- [ ] Full authority/admin authentication → privileged access journey against Firebase emulator.

## Phase 3 — Core transport workflow

- [x] GPS validation has automated coverage.
- [x] Trip lifecycle validation has automated coverage.
- [x] Offline trip queue/reconnect behavior has automated coverage.
- [x] Vehicle risk/overspeed integration logic has automated coverage.
- [ ] Automated end-to-end vehicle → driver → trip → tracking → completion journey.
- [x] Explicit duplicate/conflicting active-trip journey test.
- [ ] Realistic mobile map/tracking performance validation.

## Phase 4 — Black spots

- [x] Real GPS acquisition is tested for report creation.
- [x] Report payloads avoid fabricated coordinates.
- [x] Emergency/report failure states are covered.
- [ ] Full passenger report → evidence → SACCO review → authority resolution journey.
- [x] Storage emulator covers evidence ownership, spoofed UID paths, invalid content types, size boundaries, cross-SACCO reads and protected deletion.

## Phase 5 — Notifications and asynchronous work

- [x] SOS notification dispatch behavior is covered.
- [x] Callable failure paths are covered.
- [x] Rate-limit behavior is covered.
- [x] Suspension/reactivation audit logging is covered.
- [x] Complete Cloud Function export inventory is documented in `docs/cloud-functions-inventory.md`.
- [ ] Complete function-by-function idempotency evidence for all scheduled/analytics jobs.
- [ ] FCM delivery/invalid-token lifecycle validation in an emulator-safe test harness.

## Phase 6 — Production Firebase

- [x] Production project identity is enforced in CI.
- [x] Production Auth/Storage/frontend identifiers are validated.
- [x] Expected Google service account and Workload Identity provider are enforced.
- [x] Deployment runs only from `main` after the quality gate.
- [x] Hosting smoke test rejects an unbuilt Vite source entrypoint and validates the SPA shell/deep link.
- [ ] Verify production Maps, reCAPTCHA, FCM/VAPID and authorized-domain configuration as a single release check.

## Phase 7 — Integration/E2E

- [ ] Passenger critical journey.
- [ ] SACCO manager critical journey.
- [ ] Authority critical journey.
- [ ] Shared emulator fixtures for role/tenant isolation.
- [ ] Evidence and notification assertions within those journeys.

## Phase 8 — Reliability

- [x] Offline/reconnect failure behavior has automated coverage.
- [x] GPS denied/unavailable behavior has automated coverage.
- [x] Callable/network failure fallback behavior has automated coverage.
- [ ] Systematic matrix for expired auth, duplicate requests, refresh during mutation, upload interruption and function outage.

## Phase 9 — Security

- [x] Auth claim isolation tests exist.
- [x] SOS identity spoofing protection is tested.
- [x] Firebase production hardening tests exist.
- [x] App Check tests exist.
- [x] Rate limiting tests exist.
- [x] Firestore/Storage rules tests run in CI.
- [x] Cross-SACCO IDOR coverage exists for vehicles, complaints, violations and safety alerts.
- [x] Storage evidence path ownership and content/size boundary matrix is covered by rules tests.
- [ ] Final callable-function authorization/input matrix.

## Phase 10 — Performance/mobile

- [x] Accessibility/performance-oriented automated tests exist.
- [ ] Measure production bundle startup on representative mobile hardware/network.
- [ ] Measure map rendering and trip-tracking listener behavior.
- [ ] Measure evidence upload behavior on constrained mobile networks.

## Phase 11 — Observability/operations

- [x] Privileged suspension/reactivation operations write audit logs.
- [x] Critical failure paths emit diagnostic logs in tests.
- [ ] Verify production log correlation for passenger report lifecycle.
- [ ] Document backup/recovery procedure and perform a restore verification.
- [ ] Verify operational alerting for critical Cloud Function failures.

## Phase 12 — Deployment

- [x] Quality gate precedes production deployment.
- [x] Deployment requires `main`.
- [x] Production identity/configuration checks precede Firebase deployment.
- [x] Hosting smoke test runs after deployment.
- [ ] Add the completed integration/security/reliability suite to the quality gate once those suites exist.

## Phase 13 — Production smoke

- [x] Hosting root and SPA deep-link smoke tests exist.
- [ ] Passenger authentication smoke test.
- [ ] SACCO authentication smoke test.
- [ ] Authority authentication smoke test.
- [ ] Representative Firestore read/write smoke test.
- [ ] Representative Storage upload/read/unauthorized-access smoke test.
- [ ] Representative Cloud Function smoke test.
- [ ] Production notification smoke test.

## Phase 14 — Final acceptance

The release is **not production-ready** until all P0 items and the critical P1/P2 journey items above are verified, the full quality gate is green, and the production smoke suite passes.

### Current release blockers

1. Complete three critical role-based E2E journeys.
2. Complete final callable-function authorization/input and idempotency matrix.
3. Complete production dependency and smoke validation.
4. Complete operational backup/recovery and observability verification.
5. Complete realistic mobile/performance measurements.
