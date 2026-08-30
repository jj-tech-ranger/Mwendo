# Mwendo Salama Implementation Backlog

Updated: 2026-08-30

This is the working backlog for the application audit and production-readiness phases. Priority is based on impact, security, and whether a complete user journey can function without manual intervention.

## P0 — Broken / security-critical

- [ ] Verify every privileged route uses authoritative ID-token claims and fails closed when claims cannot be established.
- [ ] Audit all client-side role/profile reconciliation for privilege confusion between Firestore profile fields and custom claims.
- [ ] Verify registration, Google sign-in, guest upgrade, and magic-link flows all enforce the intended consent/age lifecycle without silently accepting consent.
- [ ] Complete adversarial Firestore/Storage authorization tests for cross-user, cross-SACCO, role escalation, and path manipulation.
- [ ] Audit all callable/HTTP Cloud Functions for authentication, App Check, authorization, input validation, rate limiting, and idempotency.
- [ ] Verify production configuration cannot accidentally target demo/test Firebase projects.

## P1 — Required for normal operation

### Authentication & lifecycle
- [ ] Passenger registration/login/logout/profile/recovery end-to-end.
- [ ] SACCO manager authentication and SACCO association lifecycle.
- [ ] Authority/admin authentication and MFA lifecycle.
- [ ] Session expiry, suspended accounts, token refresh, and offline recovery.

### Transport
- [ ] Vehicle create/update/deactivate lifecycle.
- [ ] Driver assignment and ownership constraints.
- [ ] Trip start → tracking → completion lifecycle.
- [ ] Duplicate/conflicting active-trip handling.
- [ ] GPS coordinate/timestamp/speed validation.
- [ ] Reconnection/offline trip persistence and reconciliation.

### Black spots
- [ ] Passenger report creation and ownership.
- [ ] Evidence upload/read/delete authorization.
- [ ] SACCO-scoped complaint visibility.
- [ ] Authority review, status changes, escalation and resolution.

### Notifications / backend
- [ ] Audit every deployed Cloud Function trigger and output.
- [ ] Verify FCM token registration and push delivery paths.
- [ ] Verify retry/idempotency behavior for asynchronous functions.
- [ ] Verify missing-document and malformed-input behavior.

### Maps / UX
- [ ] Map loading and invalid-coordinate handling.
- [ ] Live vehicle/trip positioning.
- [ ] Permission-denied/location-unavailable states.
- [ ] Network failure, loading and empty states across critical screens.

## P2 — Important polish

- [ ] Mobile responsiveness review across passenger/SACCO/authority/admin screens.
- [ ] Performance measurement for maps, Firestore listeners, images and trip tracking.
- [ ] Improve error messages and recovery actions where generic errors remain.
- [ ] Accessibility pass for forms, dialogs, maps and status announcements.
- [ ] Review offline UX and sync visibility.
- [ ] Review analytics/telemetry consent UX and preference persistence.

## P3 — Future enhancement

- [ ] Broader E2E journey coverage beyond the critical workflows.
- [ ] Advanced operational dashboards and diagnostics.
- [ ] Expanded performance budgets and low-end Android testing.
- [ ] Additional notification channels where formally required.

## Phase gates

- Phase 0: CI reproducible from clean checkout, Java 21 emulator runtime, main-only deployment source.
- Phase 1: No major application/backend area remains unaudited; this backlog is maintained as findings change.
- Phase 2+: Each phase requires targeted tests plus the full existing quality gate before advancing.
