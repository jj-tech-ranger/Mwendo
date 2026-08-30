# Mwendo Salama Implementation Backlog

Updated: 2026-08-30

This is the working backlog for the application audit and production-readiness phases. Priority is based on impact, security, and whether a complete user journey can function without manual intervention. See `docs/release-readiness.md` for the verification ledger and release blockers.

## P0 — Broken / security-critical

- [x] Verify privileged route authorization uses authoritative claims and fails closed when claims cannot be established.
- [x] Audit client-side role/profile reconciliation for privilege confusion between Firestore profile fields and custom claims.
- [x] Verify registration consent/age controls do not silently accept missing consent.
- [ ] Complete adversarial Firestore/Storage authorization tests for cross-user, cross-SACCO, role escalation, and path manipulation.
- [ ] Complete callable/HTTP Cloud Function inventory and authorization/input/idempotency matrix.
- [x] Verify production configuration cannot accidentally target demo/test Firebase projects through the deployment quality gate.

## P1 — Required for normal operation

### Authentication & lifecycle
- [ ] Passenger registration/login/logout/profile/recovery end-to-end.
- [ ] SACCO manager authentication and SACCO association lifecycle.
- [ ] Authority/admin authentication and MFA lifecycle.
- [x] Session/suspension/claim clearing boundaries have automated coverage.

### Transport
- [x] Vehicle/trip lifecycle validation has automated coverage.
- [ ] Driver assignment and ownership constraints end-to-end.
- [ ] Trip start → tracking → completion end-to-end.
- [x] GPS coordinate/timestamp/speed validation has automated coverage.
- [x] Reconnection/offline trip persistence and reconciliation has automated coverage.
- [ ] Explicit duplicate/conflicting active-trip journey test.

### Black spots
- [x] Passenger report creation and real-location behavior have automated coverage.
- [ ] Evidence upload/read/delete authorization matrix.
- [ ] SACCO-scoped complaint visibility end-to-end.
- [ ] Authority review, status changes, escalation and resolution end-to-end.

### Notifications / backend
- [ ] Audit every deployed Cloud Function trigger and output.
- [ ] Verify FCM token registration and push delivery paths.
- [x] Retry/rate-limit/failure behavior has targeted automated coverage.
- [x] Missing-document/malformed-input behavior is covered in targeted backend tests.

### Maps / UX
- [x] Map/location failure and invalid-coordinate behavior has automated coverage.
- [ ] Live vehicle/trip positioning end-to-end.
- [x] Permission-denied/location-unavailable states are covered.
- [x] Network failure, loading and empty states have targeted coverage.

## P2 — Important polish

- [ ] Mobile responsiveness review across passenger/SACCO/authority/admin screens.
- [ ] Performance measurement for maps, Firestore listeners, images and trip tracking.
- [ ] Improve error messages and recovery actions where generic errors remain.
- [x] Accessibility pass has automated coverage for critical UI.
- [x] Offline sync behavior has automated coverage; review remaining UX gaps.
- [x] Analytics/telemetry consent UX has automated coverage.
- [ ] Complete three critical role-based E2E journeys.
- [ ] Complete production smoke validation for Auth, Firestore, Storage, Functions and notifications.
- [ ] Complete operational diagnostics, backup/recovery and alerting verification.

## P3 — Future enhancement

- [ ] Broader E2E journey coverage beyond the critical workflows.
- [ ] Advanced operational dashboards and diagnostics.
- [ ] Expanded performance budgets and low-end Android testing.
- [ ] Additional notification channels where formally required.

## Phase gates

- Phase 0: **verified** — frozen-lockfile install, Java 21 emulator runtime, quality gates, rules tests, production configuration checks, and main-only deployment are present in CI.
- Phase 1: **in progress** — major application/backend areas have targeted coverage; route/function/dependency inventory still needs explicit closure.
- Phase 2–6: **in progress** — foundational security and workflow coverage is strong, but full role-based journeys and adversarial matrices remain.
- Phase 7–13: **in progress** — integration/E2E, reliability, final security, realistic mobile/performance, operations, and expanded production smoke validation remain.
- Phase 14: **blocked** until all critical release blockers in `docs/release-readiness.md` are verified.
