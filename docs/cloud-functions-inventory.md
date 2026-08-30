# Mwendo Salama Cloud Functions Inventory

Updated: 2026-08-31

Authoritative export inventory is taken from `apps/functions/src/index.ts`. This ledger is intentionally explicit so a newly added function cannot be missed during release review.

| Export | Source | Trigger | Security / reliability review status |
|---|---|---|---|
| `suspendUser` | `admin/suspendUser.ts` | Callable | Admin claim, suspension check, App Check, audit log; covered by tests |
| `reactivateUser` | `admin/suspendUser.ts` | Callable | Admin claim, suspension check, App Check, audit log; covered by tests |
| `healthCheck` | `admin/healthCheck.ts` | HTTP | Health endpoint; production smoke coverage pending |
| `verifyTotpChallenge` | `auth/verifyTotpChallenge.ts` | Callable | MFA challenge validation; covered by MFA security tests |
| `computeVehicleRisk` | `risk/computeVehicleRisk.ts` | Callable | Risk computation; covered by backend tests |
| `rebuildSaccoAnalytics` | `analytics/rebuildSaccoAnalytics.ts` | Callable | SACCO analytics rebuild; targeted authorization/idempotency review pending |
| `updateDailyAnalytics` | `analytics/updateDailyAnalytics.ts` | Callable | Analytics mutation; duplicate/failure review pending |
| `dailyAnalyticsScheduled` | `analytics/updateDailyAnalytics.ts` | Scheduled | Daily analytics job; retry/idempotency review pending |
| `syncPublicPins` | `pins/syncPublicPins.ts` | Callable | Public map-pin synchronization; input/idempotency review pending |
| `sendSOS` | `alerts/sendSOS.ts` | Callable | Identity/location/rate-limit handling; targeted tests exist |
| `reportBlackSpot` | `reports/reportBlackSpot.ts` | Callable | Report validation and persistence; end-to-end workflow pending |
| `createInspection` | `inspections/createInspection.ts` | Callable | Inspection creation; authorization/input matrix pending |
| `dailyPurge` | `scheduled/dailyPurge.ts` | Scheduled | Retention/purge job; destructive-operation verification pending |
| `weeklyReport` | `scheduled/weeklyReport.ts` | Scheduled | Report generation; retry/idempotency review pending |
| `monthlyArchival` | `scheduled/monthlyArchival.ts` | Scheduled | Archival job; retry/idempotency/restore review pending |

## Release rule

Every export in `index.ts` must have a row here and must have evidence for authentication/authorization, input validation, writes/side effects, failure handling, and duplicate execution behavior before the Phase 5 gate is marked complete.

## Current gap

The inventory is complete at the export level. The remaining work is to attach executable coverage to the rows marked pending, especially scheduled-job idempotency and production-safe smoke tests.
