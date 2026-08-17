# Mwendosalama End-to-End Data Integration Guide

This document serves as the comprehensive single source of truth for data integration, security architecture, Cloud Functions reference, API contracts, state management, form rules, and database seeding strategies for the Mwendosalama road safety platform.

---

## 1. Firestore Architecture & Collection Schema

### 1.1 Collections & Document Schemas

#### 1. Operational Collections

##### `/users/{userId}`
* **Description:** User profile records supporting multi-role authorization and active role context.
* **Schema:**
  ```json
  {
    "uid": "string (matches Auth UID)",
    "email": "string",
    "displayName": "string (max 100 chars)",
    "phoneNumber": "string (e.g. +254712345678)",
    "role": "string (passenger | sacco_official | sacco_manager | authority | admin)",
    "activeRole": "string (passenger | sacco_official | sacco_manager | authority | admin)",
    "roles": "array<string>",
    "saccoId": "string (optional)",
    "authorityId": "string (optional)",
    "isVerified": "boolean",
    "isActive": "boolean",
    "trustScore": "number (0.0 to 1.0)",
    "trustBadge": "string (bronze | silver | gold | verified_guardian)",
    "createdAt": "string (ISO 8601)",
    "updatedAt": "string (ISO 8601)"
  }
  ```
* **Security Rule:** Governed by `match /users/{userId}`. Users can read/update their own profile; admins can edit or delete.
* **Query Strategy:** One-shot `getDoc()` on login/role switch. Real-time `onSnapshot()` for active session user context in `useAuthStore`.

##### `/trips/{tripId}`
* **Description:** Active and historical passenger/driver matatu trips.
* **Schema:**
  ```json
  {
    "id": "string",
    "userId": "string",
    "vehicleRegNumber": "string",
    "saccoId": "string",
    "saccoName": "string",
    "routeName": "string",
    "status": "string (scheduled | active | completed | auto_completed | cancelled | discarded)",
    "currentSpeedKmH": "number",
    "maxSpeedKmH": "number",
    "avgSpeedKmH": "number",
    "startTime": "string (ISO 8601)",
    "endTime": "string (ISO 8601, optional)",
    "telemetryStoragePath": "string (optional)",
    "createdAt": "string (ISO 8601)"
  }
  ```
* **Security Rule:** `match /trips/{tripId}`. Read access for signed-in users; updates restricted to trip owner, assigned SACCO manager, or authority.
* **Query Strategy:** Real-time `onSnapshot()` during active trips (2s interval). Paginated one-shot `getDocs()` for trip history with `orderBy('startTime', 'desc')`.

##### `/vehicles/{vehicleId}`
* **Description:** Public service vehicle records, risk scores, and risk tiers.
* **Schema:**
  ```json
  {
    "id": "string",
    "regNumber": "string",
    "saccoId": "string",
    "saccoName": "string",
    "capacity": "number",
    "status": "string (active | maintenance | suspended)",
    "riskScore": "number (0 to 100)",
    "riskTier": "string (low | medium | high | critical)",
    "isProvisional": "boolean",
    "insuranceExpiry": "string (ISO 8601)",
    "inspectionExpiry": "string (ISO 8601)"
  }
  ```
* **Security Rule:** `match /vehicles/{vehicleId}`. Read for signed-in users; writes restricted to SACCO managers and authorities.

##### `/saccos/{saccoId}`
* **Description:** SACCO cooperative entities and aggregate safety scores.
* **Schema:**
  ```json
  {
    "id": "string",
    "name": "string",
    "registrationCode": "string",
    "fleetCount": "number",
    "safetyScore": "number (0 to 100)",
    "status": "string (active | under_review | suspended)",
    "contactPhone": "string",
    "contactEmail": "string"
  }
  ```
* **Security Rule:** `match /saccos/{saccoId}`. Read for signed-in users; write for SACCO managers and authorities.

##### `/black_spots/{spotId}`
* **Description:** High-risk accident locations and road hazards.
* **Schema:**
  ```json
  {
    "id": "string",
    "name": "string",
    "routeName": "string",
    "latitude": "number",
    "longitude": "number",
    "severity": "string (low | medium | high | critical)",
    "hazardDescription": "string",
    "reportedByUid": "string",
    "verifiedByAuthority": "boolean",
    "evidencePhotoUrls": "array<string>"
  }
  ```
* **Security Rule:** `match /black_spots/{spotId}`. Public read access; write for authenticated users; verification for authorities.

##### `/safety_alerts/{alertId}`
* **Description:** Real-time overspeed and emergency SOS alerts.
* **Schema:**
  ```json
  {
    "id": "string",
    "tripId": "string",
    "vehicleRegNumber": "string",
    "saccoId": "string",
    "type": "string (overspeeding | blackspot_approaching | harsh_braking | sos | route_deviation)",
    "severity": "string (low | medium | high | critical)",
    "message": "string",
    "latitude": "number",
    "longitude": "number",
    "speedKmH": "number",
    "timestamp": "string (ISO 8601)",
    "status": "string (active | resolved | cancelled)"
  }
  ```
* **Security Rule:** `match /safety_alerts/{alertId}`. Real-time subscription for authenticated users.

##### `/violations/{violationId}`
* **Description:** Speeding and safety violations recorded automatically or manually.
* **Schema:**
  ```json
  {
    "id": "string",
    "tripId": "string",
    "saccoId": "string",
    "vehicleRegNumber": "string",
    "recordedSpeedKmH": "number",
    "speedLimitKmH": "number",
    "durationSec": "number",
    "severity": "string (medium | high | critical)",
    "status": "string (pending | reviewed | disputed | dismissed)",
    "timestamp": "string (ISO 8601)"
  }
  ```

##### `/complaints/{complaintId}`
* **Description:** Passenger and citizen complaints.
* **Schema:**
  ```json
  {
    "id": "string",
    "saccoId": "string",
    "vehicleRegNumber": "string",
    "title": "string",
    "description": "string",
    "reportedByUid": "string",
    "status": "string (open | investigating | resolved | dismissed)",
    "createdAt": "string (ISO 8601)"
  }
  ```

##### `/processedEvents/{eventId}`
* **Description:** Cloud Function idempotency ledger preventing duplicate event execution.
* **Schema:**
  ```json
  {
    "eventId": "string",
    "handler": "string",
    "vehicleRegNumber": "string",
    "processedAt": "string (ISO 8601)"
  }
  ```

#### 2. Pre-Aggregated / CQRS Collections (`/analytics/`)

##### `/analytics/daily_{dateStr}`
* **Description:** Daily platform performance and safety metrics.
* **Schema:**
  ```json
  {
    "id": "daily_2026-08-08",
    "date": "2026-08-08",
    "type": "daily",
    "totalTrips": 1240,
    "totalViolations": 18,
    "activeAlerts": 2,
    "riskDistribution": { "low": 85, "medium": 12, "high": 2, "critical": 1 },
    "updatedAt": "string (ISO 8601)"
  }
  ```

##### `/analytics/sacco_{saccoId}`
* **Description:** Pre-aggregated SACCO safety performance metrics.
* **Schema:**
  ```json
  {
    "id": "sacco_sac_201",
    "saccoId": "sac_201",
    "type": "sacco",
    "safetyScore": 88,
    "fleetCount": 45,
    "unresolvedComplaints": 1,
    "updatedAt": "string (ISO 8601)"
  }
  ```

---

## 2. Firebase Storage Architecture & Policy

| Path Pattern | Content Type | Max Size | Read Access | Write Access | Retention |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `avatars/{userId}/avatar_{timestamp}.jpg` | `image/(jpeg\|png\|webp)` | 2MB | Public | Owner (`auth.uid == userId`) | Permanent |
| `black_spots/{spotId}/photo_{timestamp}.jpg` | `image/(jpeg\|png\|webp)` | 5MB | Public | Authenticated Users | 1 Year |
| `evidence/{complaintId}/evidence_{timestamp}.jpg` | `image/*`, `video/*` | 5MB | Signed-in Users | Authenticated Users | 2 Years |
| `telemetry/{userId}/trip_{tripId}_{timestamp}.json` | `application/json` | 10MB | Owner (`auth.uid == userId`) | Owner (`auth.uid == userId`) | 90 Days |

---

## 3. Cloud Functions Gen 2 Architecture

| Function Name | Trigger | Idempotency Ledger | Retry / DLQ | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `suspendUser` | Callable (Admin) | Audit Log | Direct retry | Suspends user profile, revokes tokens, sets custom claims |
| `reactivateUser` | Callable (Admin) | Audit Log | Direct retry | Restores user active status and updates claims |
| `computeVehicleRisk` | Callable / Event | `processedEvents/{eventId}` | 5 attempts / `dlq_notifications` | Applies 30-day half-life decay risk score updates to vehicles |
| `onVehicleClaimed` | Callable | N/A (Batch) | ≤450 ops batching | Two-phase paginated backfill of provisional vehicles to SACCOs |
| `syncPublicPins` | Scheduled / Callable | N/A (Overwrite) | Direct retry | Syncs verified black spots to `/public_pins` collection |
| `updateDailyAnalytics` | Scheduled / Callable | N/A (Merge) | Direct retry | CQRS daily aggregation of platform statistics |
| `rebuildSaccoAnalytics` | Callable / Event | N/A (Merge) | Direct retry | Recalculates SACCO safety score and fleet risk |

### 3.1 App Check Enforcement Policy (SEC-002)

All callable 2nd-gen Cloud Functions enforce Firebase App Check by default (`APP_CHECK_ENFORCED = process.env.APP_CHECK_ENFORCED !== 'false'`). 

* **Default-Enforced Policy:** Enforcement is decoupled from runtime-inferred `NODE_ENV`. In production and staging deployments, all incoming requests without a valid App Check token are rejected with `401 Unauthorized` / `UNAUTHENTICATED (AppCheck missing)`.
* **CI & Production Environments:** App Check tokens are required. App Check debug tokens must be registered in the Firebase Console under **App Check > Apps > Manage debug tokens** for automated environments.
* **Local Emulator & Test Bypass:** For local emulator runs or testing where debug tokens are unavailable, set `APP_CHECK_ENFORCED=false` in `.env.local` (or `apps/functions/.env.local`). Never deploy with `APP_CHECK_ENFORCED=false` in production.


---

## 4. API Specification & Error Codes

### Standard Error Codes
| Error Code | HTTP / Standard Mapping | Meaning |
| :--- | :--- | :--- |
| `UNAUTHENTICATED` | 401 | User must be signed in |
| `PERMISSION_DENIED` | 403 | Active role context lacks authorization |
| `INVALID_ARGUMENT` | 400 | Payload fails validation rules |
| `NOT_FOUND` | 404 | Target entity does not exist |
| `ALREADY_EXISTS` | 409 | Event or vehicle claim already processed |
| `RESOURCE_EXHAUSTED` | 429 | Rate limit exceeded |

---

## 5. React Query & State Management

### Query Keys & Cache Durations
* `['trips', 'active', userId]`: Stale time 2,000ms (2s live updates)
* `['safety_alerts', 'live']`: Stale time 3,000ms (3s live alerts)
* `['vehicles', saccoId]`: Stale time 15,000ms (15s)
* `['saccos', 'all']`: Stale time 60,000ms (1m)
* `['analytics', 'daily', dateStr]`: Stale time 300,000ms (5m)
* `['remote_config']`: Stale time 1,800,000ms (30m)

---

## 6. End-to-End User Journey Trace

```
[Passenger App] Starts Trip on vehicle "KCA 999Z"
      │
      ▼
Creates `/trips/trip_101` (status: active)
      │
      ▼ (GPS Stream via SpeedSmoother EMA)
Overspeed detected (105 km/h for >4s)
      │
      ▼
Creates `/violations/viol_501` & `/safety_alerts/alt_301`
      │
      ▼
Triggers `computeVehicleRisk({ eventId: 'viol_501' })`
      │
      ▼
`processedEvents/viol_501` recorded (Idempotency Ledger)
      │
      ▼
Vehicle "KCA 999Z" risk score updated in `/vehicles/KCA_999Z`
      │
      ▼
Triggers `rebuildSaccoAnalytics({ saccoId: 'sac_201' })`
      │
      ▼
Updates `/analytics/sacco_sac_201` and `/saccos/sac_201`
      │
      ▼
[SACCO Manager & Authority Dashboards] Instant update via CQRS query
```
