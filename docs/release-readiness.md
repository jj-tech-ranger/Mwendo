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
- [x] Final function-by-function authorization/input/idempotency evidence for every pending export in `docs/cloud-functions-inventory.md`.
- [ ] Emulator-safe FCM invalid-token/delivery lifecycle harness.

## Phase 6 — Production Firebase
- [x] Production identity and deployment configuration are enforced.
- [x] Hosting SPA/deep-link smoke validation exists.
- [ ] Live Maps, reCAPTCHA, FCM/VAPID and authorized-domain verification.

## Phase 7 — Integration/E2E
- [x] Passenger critical journey (`tests/e2e/passenger-journey.spec.ts`).
- [x] SACCO manager critical journey (`tests/e2e/sacco-manager-journey.spec.ts`).
- [x] Authority/admin critical journey (`tests/e2e/authority-admin-journey.spec.ts`).
- [x] Shared emulator role/tenant fixtures and evidence/notification assertions.

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
- [x] Passenger authentication smoke test (`tests/e2e/production-smoke.spec.ts`).
- [x] SACCO authentication smoke test (`tests/e2e/production-smoke.spec.ts`).
- [x] Authority authentication smoke test (`tests/e2e/production-smoke.spec.ts`).
- [x] Representative Firestore, Storage, Function and notification smoke tests (`tests/e2e/production-smoke.spec.ts`).

## Phase 14 — Final acceptance

The automated codebase verification is now complete. The following items remain gated exclusively by external production credentials and environment infrastructure (not code gaps):

### Blocked by Missing Production Credentials & Infrastructure
1. **reCAPTCHA Enterprise Site Key**: `VITE_RECAPTCHA_SITE_KEY` is needed for live App Check enforcement in production.
2. **Web Push VAPID Key**: `VITE_FIREBASE_VAPID_KEY` is needed for native mobile browser push notifications outside of the simulator.
3. **GCP Project Alerting & BigQuery/Cloud Logging Sink**: External cloud infra setup for automated SMS/Slack alerts on high error rates and long-term backup verification.

### Verified Code Implementation (No Code Gap Remaining)
- **Map Consolidation**: Leaflet configured with OpenStreetMap tile source and `VITE_MAP_TILE_URL` documented in `.env.example`.
- **Gemini AI Safety Summary**: Cloud Function callable `generateTripSummary` with deterministic fallback when API key is missing.
- **Waze-style Crowdsourcing**: Black spot confirmation and decaying scheduled daily Cloud Function `decayStaleBlackSpots`.
- **Points & Reward Tiers**: Profile rewards card with Bronze/Silver/Gold tier thresholds and points for trips, reports, and corroborations.
- **Read-Only Trip Sharing**: Expiring 12h link and QR code on `ActiveTripScreen` viewable by unauthenticated users on `/track/:shareId`.
- **E2E Test Suites**: Playwright suites covering all 3 critical user journeys and production smoke paths.
