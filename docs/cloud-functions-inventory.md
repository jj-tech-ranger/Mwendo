# Mwendo Salama Cloud Functions Inventory

Updated: 2026-08-31

Authoritative export inventory is taken from `apps/functions/src/index.ts`. This ledger is intentionally explicit so a newly added function cannot be missed during release review.

| Export | Source | Trigger | Security / reliability review status |
|---|---|---|---|
| `suspendUser` | `admin/suspendUser.ts` | Callable | Admin claim, suspension check, App Check, audit log; covered by tests in `suspend-reactivate.test.ts` |
| `reactivateUser` | `admin/suspendUser.ts` | Callable | Admin claim, suspension check, App Check, audit log; covered by tests in `suspend-reactivate.test.ts` |
| `healthCheck` | `admin/healthCheck.ts` | Callable | Admin role check, Firestore probe write, latency logging; covered by tests in `health-check.test.ts` |
| `verifyTotpChallenge` | `auth/verifyTotpChallenge.ts` | Callable | MFA challenge validation; covered by MFA security tests in `mfa-security.test.tsx` |
| `computeVehicleRisk` | `risk/computeVehicleRisk.ts` | Callable | Risk computation; covered by backend tests in `compute-vehicle-risk.test.ts` |
| `rebuildSaccoAnalytics` | `analytics/rebuildSaccoAnalytics.ts` | Callable | SACCO analytics rebuild; authorization, tenant isolation, and idempotency covered in `analytics.test.ts` |
| `updateDailyAnalytics` | `analytics/updateDailyAnalytics.ts` | Callable | Date-scoped daily analytics; role check, input validation, and duplicate execution covered in `analytics.test.ts` |
| `dailyAnalyticsScheduled` | `analytics/updateDailyAnalytics.ts` | Scheduled | Daily analytics cron; yesterday/today rolling metrics calculation covered in `analytics.test.ts` and `scheduled-jobs.test.ts` |
| `syncPublicPins` | `pins/syncPublicPins.ts` | Callable | Public map-pin synchronization; status filtering, unverified purging, and idempotency covered in `sync-public-pins.test.ts` |
| `sendSOS` | `alerts/sendSOS.ts` | Callable | Identity, trusted vehicle resolution, SMS/FCM routing, location validation, and rate limits covered in `send-sos-security-matrix.test.ts` and `location-validation.test.ts` |
| `reportBlackSpot` | `reports/reportBlackSpot.ts` | Callable | Location bounding box, input validation, 24-hr rate limits, and audit log covered in `report-black-spot.test.ts` and `location-validation.test.ts` |
| `createInspection` | `inspections/createInspection.ts` | Callable | Authority/admin authorization, SACCO tenant match, certificate generation, and transactional audit log covered in `create-inspection.test.ts` |
| `dailyPurge` | `scheduled/dailyPurge.ts` | Scheduled | Batch deletion of expired processedEvents and DLQ notifications (> 30 days) covered in `scheduled-jobs.test.ts` |
| `weeklyReport` | `scheduled/weeklyReport.ts` | Scheduled | Aggregated compliance summary and SACCO breakdown generation covered in `scheduled-jobs.test.ts` |
| `monthlyArchival` | `scheduled/monthlyArchival.ts` | Scheduled | Batch archival of trips (> 1 yr) and violations (> 2 yrs) covered in `scheduled-jobs.test.ts` |

## Release rule

Every export in `index.ts` must have a row here and must have evidence for authentication/authorization, input validation, writes/side effects, failure handling, and duplicate execution behavior before the Phase 5 gate is marked complete.

## Current status

All 15 authoritative Cloud Function exports in `apps/functions/src/index.ts` have documented security reviews and targeted automated test coverage across unit, authorization, input validation, rate limiting, and idempotency test suites.
