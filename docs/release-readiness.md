# Mwendo Salama Release Readiness

Updated: 2026-08-31

This document is the final validation ledger for the production-readiness programme. A check is marked **verified** only when the repository contains an automated test, CI gate, or explicit production validation supporting it. Environment-dependent items remain release blockers until executed.

## Phase 0 — Baseline
- [x] Frozen dependency installation, lint/typecheck, frontend build, bundle security, Functions build, Vitest, and Firebase rules gates are defined in CI.
- [x] Java 21 is installed for Firebase Emulator Suite tests.
- [x] Production deployment is restricted to pushes to `main` after the quality gate.
- [x] Production Firebase identity/configuration checks exist.

## Phase 1 — Audit coverage
- [x] Authentication/authorization, route guards, MFA, consent/age, trip/vehicle risk, GPS, black spots, SOS, offline queueing, analytics, accessibility and Firebase hardening have automated coverage.
- [x] Cloud Function export inventory is complete in `docs/cloud-functions-inventory.md`.
- [ ] Complete route-by-route journey inventory.
- [ ] Complete Firestore index/query inventory.
- [ ] Complete production dependency inventory and live validation.

## Phase 2–5 — Lifecycle, transport, black spots, notifications
- [x] Core validation, lifecycle, offline/reconnect, SOS, rate limits, Storage ownership and cross-SACCO isolation are covered.
- [x] Scheduled purge/archival logic drains batches and is retry-safe.
- [x] Deterministic analytics/report writes are used for repeat execution.
- [ ] Final function-by-function authorization/input/idempotency evidence for every pending export.
- [ ] Emulator-safe FCM invalid-token/delivery lifecycle harness.

## Phase 6 — Production Firebase
- [x] Production identity and deployment configuration are enforced.
- [x] Hosting SPA/deep-link smoke validation exists.
- [ ] Live Maps, reCAPTCHA, FCM/VAPID and authorized-domain verification.

## Phase 7 — Integration/E2E
- [ ] Passenger critical journey.
- [ ] SACCO manager critical journey.
- [ ] Authority/admin critical journey.
- [ ] Shared emulator role/tenant fixtures and evidence/notification assertions.

## Phase 8–10 — Reliability, security, performance
- [x] Authentication failure, GPS failure, callable fallback, rules, App Check, rate limiting and major IDOR paths have automated coverage.
- [ ] Final callable authorization/input matrix.
- [ ] Production mobile startup/bundle measurement.
- [ ] Map/tracking listener measurement.
- [ ] Constrained-network evidence upload measurement.

## Phase 11 — Operations
- [x] Privileged audit logging and diagnostic failure logs exist.
- [ ] Production passenger-report log correlation.
- [ ] Backup/recovery procedure and restore verification.
- [ ] Critical Cloud Function alerting verification.

## Phase 12–13 — Deployment and production smoke
- [x] Quality gate precedes production deployment.
- [x] Deployment requires `main` and production identity checks.
- [x] Hosting smoke test exists.
- [ ] Passenger authentication smoke test.
- [ ] SACCO authentication smoke test.
- [ ] Authority authentication smoke test.
- [ ] Representative Firestore, Storage, Function and notification smoke tests.

## Phase 14 — Final acceptance

The release is **not production-ready** until all critical journey, callable-security, production-smoke, operational and performance blockers are verified and the full quality gate is green.

### Remaining release blockers
1. Three critical browser/emulator role journeys.
2. Final callable authorization/input/idempotency matrix.
3. Live production dependency and smoke validation.
4. Backup/restore, log correlation and alerting verification.
5. Representative mobile/performance measurements.
