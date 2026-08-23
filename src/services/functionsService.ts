import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '../lib/firebase';
import { SeverityLevel, PlatformAnalyticsDaily, SaccoAnalyticsDaily } from '../types';
import {
  calculateVehicleRiskScore,
  calculateSaccoSafetyScore,
  calculateReporterTrustScore,
  getTrustBadgeLevel,
  detectOverspeedViolations,
  GPSSample,
  RiskEvent,
} from '../lib/engine';

/**
 * Functions Service
 * Client-side handling and Cloud Function dispatchers for vehicle risk calculations,
 * incident dispatch, alerts, and analytics synchronization.
 */

export interface VehicleRiskEvent {
  eventId: string;
  vehicleRegNumber: string;
  vehicleId?: string;
  saccoId: string;
  eventType: 'violation' | 'inspection' | 'complaint' | 'overspeed' | 'accident';
  severity: SeverityLevel;
  recordedSpeedKmH?: number;
  speedLimitKmH?: number;
  confidenceScore?: number;
  timestamp: string;
}

export const functionsService = {
  /**
   * Gen 2 Function: computeVehicleRisk (§9.3)
   * Idempotent vehicle risk score calculator via processedEvents/{eventId} ledger.
   * Uses exposure-normalized 30-day half-life decay.
   */
  async computeVehicleRisk(event: VehicleRiskEvent): Promise<{ processed: boolean; riskScore: number; riskTier: string }> {
    const ledgerRef = doc(db, 'processedEvents', event.eventId);
    let isAlreadyProcessed = false;

    // Idempotency check
    // This client-side idempotency guard is best-effort only post-SEC-007; the authoritative guard requires the Cloud-Functions Admin-SDK write path landing in Phase 3 (BE-001).
    try {
      const ledgerSnap = await getDoc(ledgerRef);
      if (ledgerSnap.exists()) {
        isAlreadyProcessed = true;
      }
    } catch {
      // Ignored: Post-SEC-007, processedEvents is read/write restricted to Admin/Server SDK.
    }

    if (isAlreadyProcessed) {
      console.log(`[computeVehicleRisk] Event ${event.eventId} already processed.`);
      return { processed: false, riskScore: 0, riskTier: 'existing' };
    }

    try {
      // Mark event as processed in ledger
      await setDoc(ledgerRef, {
        eventId: event.eventId,
        handler: 'computeVehicleRisk',
        vehicleRegNumber: event.vehicleRegNumber,
        processedAt: new Date().toISOString(),
      });
    } catch {
      // Ignored: Post-SEC-007, non-admin client writes to processedEvents are blocked by security rules.
    }

    // Lookup vehicle and past risk events
    const vehicleId = event.vehicleId || event.vehicleRegNumber.replace(/\s+/g, '_');
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    const vehicleSnap = await getDoc(vehicleRef);

    // Auto-provision vehicle if provisional
    if (!vehicleSnap.exists()) {
      await this.provisionProvisionalVehicle(event.vehicleRegNumber, event.saccoId);
    }

    // Query recent violations/events for vehicle
    const violQuery = query(
      collection(db, 'violations'),
      where('vehicleRegNumber', '==', event.vehicleRegNumber)
    );
    const violSnap = await getDocs(violQuery);
    const nowMs = Date.now();
    const eventsList: RiskEvent[] = violSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          severity: (data.severity || 'low') as SeverityLevel,
          timestamp: data.timestamp || new Date().toISOString(),
          confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 1.0,
          recordedSpeedKmH: typeof data.recordedSpeedKmH === 'number' ? data.recordedSpeedKmH : undefined,
        };
      })
      .filter((e) => {
        // VT-003: Plausibility filter - reject impossible speeds (>180 km/h) and unparseable timestamps
        if (e.recordedSpeedKmH !== undefined && (e.recordedSpeedKmH < 0 || e.recordedSpeedKmH > 180)) {
          return false;
        }
        const t = new Date(e.timestamp).getTime();
        return Number.isFinite(t);
      });

    // Add current event to calculation if plausible
    const incomingTimeMs = new Date(event.timestamp).getTime();
    if (
      Number.isFinite(incomingTimeMs) &&
      (event.recordedSpeedKmH === undefined || (event.recordedSpeedKmH >= 0 && event.recordedSpeedKmH <= 180))
    ) {
      eventsList.push({
        severity: event.severity,
        timestamp: event.timestamp,
        confidenceScore: typeof event.confidenceScore === 'number' ? event.confidenceScore : 1.0,
      });
    }

    // Query total trip count for regularization floor
    const tripsQuery = query(
      collection(db, 'trips'),
      where('vehicleRegNumber', '==', event.vehicleRegNumber)
    );
    const tripsSnap = await getDocs(tripsQuery);
    const totalTripCount = tripsSnap.size || 1;

    // Compute exact risk score using 30-day decay formula & sub-100 regularization
    const { riskScore, riskTier } = calculateVehicleRiskScore(eventsList, totalTripCount, nowMs);

    try {
      await updateDoc(vehicleRef, {
        riskScore,
        riskTier,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[functionsService] Client update of vehicle risk score restricted by security policy:', err);
    }

    // Record audit log
    await setDoc(doc(collection(db, 'audit_logs')), {
      action: 'COMPUTE_VEHICLE_RISK',
      actorName: 'System (Cloud Function)',
      actorRole: 'system',
      target: event.vehicleRegNumber,
      saccoId: event.saccoId,
      timestamp: new Date().toISOString(),
      details: { eventId: event.eventId, riskScore, riskTier, totalEvents: eventsList.length },
    });

    return { processed: true, riskScore, riskTier };
  },

  /**
   * Provisional vehicle auto-provisioning (§8.2)
   */
  async provisionProvisionalVehicle(vehicleRegNumber: string, saccoId: string = 'unassigned'): Promise<void> {
    const vehicleId = vehicleRegNumber.replace(/\s+/g, '_');
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    const snap = await getDoc(vehicleRef);

    if (!snap.exists()) {
      await setDoc(vehicleRef, {
        id: vehicleId,
        regNumber: vehicleRegNumber,
        saccoId,
        saccoName: saccoId === 'unassigned' ? 'Independent / Unassigned' : saccoId,
        capacity: 14,
        status: 'active',
        isProvisional: true,
        riskScore: 85,
        riskTier: 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log(`[VehicleResolution] Provisioned provisional vehicle for ${vehicleRegNumber}`);
    }
  },

  /**
   * Gen 2 Function: onVehicleClaimed (§9.4)
   * Two-phase paginated backfill in ≤450-op batches with independent collection loops.
   */
  async onVehicleClaimed(vehicleRegNumber: string, targetSaccoId: string, targetSaccoName: string): Promise<{ updatedCount: number }> {
    let totalOps = 0;

    // Update vehicle doc
    const vehicleId = vehicleRegNumber.replace(/\s+/g, '_');
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    const vehicleSnap = await getDoc(vehicleRef);
    if (vehicleSnap.exists()) {
      await updateDoc(vehicleRef, {
        saccoId: targetSaccoId,
        saccoName: targetSaccoName,
        isProvisional: false,
        updatedAt: new Date().toISOString(),
      });
      totalOps++;
    }

    // Loop 1: Trips backfill
    const tripsQuery = query(
      collection(db, 'trips'),
      where('vehicleRegNumber', '==', vehicleRegNumber)
    );
    const tripsSnap = await getDocs(tripsQuery);
    let batch = writeBatch(db);
    let opsCount = 0;

    for (const tripDoc of tripsSnap.docs) {
      batch.update(tripDoc.ref, {
        saccoId: targetSaccoId,
        saccoName: targetSaccoName,
        updatedAt: new Date().toISOString(),
      });
      opsCount++;
      totalOps++;

      if (opsCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        opsCount = 0;
      }
    }
    if (opsCount > 0) {
      await batch.commit();
      batch = writeBatch(db);
      opsCount = 0;
    }

    // Loop 2: Violations backfill
    const violQuery = query(
      collection(db, 'violations'),
      where('vehicleRegNumber', '==', vehicleRegNumber)
    );
    const violSnap = await getDocs(violQuery);

    for (const violDoc of violSnap.docs) {
      batch.update(violDoc.ref, {
        saccoId: targetSaccoId,
        updatedAt: new Date().toISOString(),
      });
      opsCount++;
      totalOps++;

      if (opsCount >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        opsCount = 0;
      }
    }
    if (opsCount > 0) {
      await batch.commit();
    }

    return { updatedCount: totalOps };
  },

  /**
   * Gen 2 Function: syncPublicPins (§9.5)
   * Periodically syncs high-severity black spots to the lightweight public_pins collection.
   * NOTE (SEC-005 / §7.3): syncPublicPins MUST ONLY copy records where verifiedByAuthority: true / status: 'published'.
   * It MUST NEVER copy reportedByUid, user PII, or unmoderated reports to public_pins. The real version will be enforced in Phase 3 backend Cloud Functions.
   */
  async syncPublicPins(): Promise<{ syncedCount: number }> {
    const spotsQuery = query(
      collection(db, 'black_spots'),
      where('verifiedByAuthority', '==', true)
    );
    const snap = await getDocs(spotsQuery);
    const batch = writeBatch(db);
    let count = 0;

    for (const spotDoc of snap.docs) {
      const data = spotDoc.data();
      const pinRef = doc(db, 'public_pins', spotDoc.id);
      batch.set(pinRef, {
        id: spotDoc.id,
        title: data.name || data.title || 'Hazardous Spot',
        routeName: data.routeName || '',
        latitude: data.latitude,
        longitude: data.longitude,
        severity: data.severity,
        updatedAt: new Date().toISOString(),
      });
      count++;
    }

    if (count > 0) {
      await batch.commit();
    }

    return { syncedCount: count };
  },

  /**
   * Gen 2 Function: updateDailyAnalytics (§8.2 CQRS)
   * Pre-aggregates daily metrics into analytics/daily_{dateStr}
   * Scoped strictly by date range to prevent unbounded collection scans.
   */
  async updateDailyAnalytics(dateStr: string): Promise<PlatformAnalyticsDaily> {
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
    const startIso = startOfDay.toISOString();
    const endIso = endOfDay.toISOString();

    const tripsSnap = await getDocs(
      query(
        collection(db, 'trips'),
        where('startTime', '>=', startIso),
        where('startTime', '<=', endIso)
      )
    );
    const violSnap = await getDocs(
      query(
        collection(db, 'violations'),
        where('timestamp', '>=', startIso),
        where('timestamp', '<=', endIso)
      )
    );
    const alertsSnap = await getDocs(
      query(
        collection(db, 'safety_alerts'),
        where('timestamp', '>=', startIso),
        where('timestamp', '<=', endIso)
      )
    );
    const vehiclesSnap = await getDocs(collection(db, 'vehicles'));

    const totalTrips = tripsSnap.size;
    const totalViolations = violSnap.size;
    const activeAlerts = alertsSnap.docs.filter((d) => d.data().status === 'active').length;

    let lowRiskCount = 0;
    let mediumRiskCount = 0;
    let highRiskCount = 0;
    let criticalRiskCount = 0;

    vehiclesSnap.docs.forEach((d) => {
      const tier = d.data().riskTier;
      if (tier === 'critical') criticalRiskCount++;
      else if (tier === 'high') highRiskCount++;
      else if (tier === 'medium') mediumRiskCount++;
      else lowRiskCount++;
    });

    const docId = `daily_${dateStr}`;
    const analyticsRef = doc(db, 'analytics', docId);

    const payload: PlatformAnalyticsDaily = {
      id: docId,
      docId,
      date: dateStr,
      type: 'daily',
      totalTrips,
      totalViolations,
      activeAlerts,
      riskDistribution: {
        low: lowRiskCount,
        medium: mediumRiskCount,
        high: highRiskCount,
        critical: criticalRiskCount,
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(analyticsRef, payload, { merge: true });
    } catch (err) {
      console.warn('[functionsService] Client update of analytics record restricted by security policy:', err);
    }
    return payload;
  },

  /**
   * Function: rebuildSaccoAnalytics
   * Computes and writes pre-aggregated SACCO safety score to analytics/sacco_{saccoId}
   */
  async rebuildSaccoAnalytics(saccoId: string): Promise<SaccoAnalyticsDaily> {
    const vehiclesQuery = query(collection(db, 'vehicles'), where('saccoId', '==', saccoId));
    const vehiclesSnap = await getDocs(vehiclesQuery);

    const scores = vehiclesSnap.docs.map((d) => d.data().riskScore ?? 85);

    const complaintsQuery = query(
      collection(db, 'complaints'),
      where('saccoId', '==', saccoId),
      where('status', '==', 'open')
    );
    const complaintsSnap = await getDocs(complaintsQuery);
    const unresolvedCount = complaintsSnap.size;

    const saccoSafetyScore = calculateSaccoSafetyScore(scores, unresolvedCount);

    // Update SACCO doc
    const saccoRef = doc(db, 'saccos', saccoId);
    const saccoSnap = await getDoc(saccoRef);
    if (saccoSnap.exists()) {
      try {
        await updateDoc(saccoRef, {
          safetyScore: saccoSafetyScore,
          fleetCount: vehiclesSnap.size,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[functionsService] Client update of SACCO safetyScore restricted by security policy:', err);
      }
    }

    const docId = `sacco_${saccoId}`;
    const payload: SaccoAnalyticsDaily = {
      id: docId,
      docId,
      saccoId,
      type: 'sacco',
      safetyScore: saccoSafetyScore,
      fleetCount: vehiclesSnap.size,
      unresolvedComplaints: unresolvedCount,
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'analytics', docId), payload, { merge: true });
    } catch (err) {
      console.warn('[functionsService] Client update of SACCO analytics restricted by security policy:', err);
    }
    return payload;
  },

  /**
   * Trust Engine: update user reporter trust score and badge (§8.2)
   */
  async updateReporterTrust(userId: string): Promise<{ trustScore: number; trustBadge: string }> {
    const complaintsQuery = query(collection(db, 'complaints'), where('reportedByUid', '==', userId));
    const complaintsSnap = await getDocs(complaintsQuery);

    let confirmedCount = 0;
    let falseCount = 0;

    complaintsSnap.docs.forEach((d) => {
      const st = d.data().status;
      if (st === 'resolved' || st === 'verified') confirmedCount++;
      if (st === 'dismissed' || st === 'false') falseCount++;
    });

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    let accountAgeDays = 30;

    if (userSnap.exists()) {
      const createdAt = userSnap.data().createdAt;
      if (createdAt) {
        accountAgeDays = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const trustScore = calculateReporterTrustScore(confirmedCount, falseCount, accountAgeDays);
    const trustBadge = getTrustBadgeLevel(trustScore);

    if (userSnap.exists()) {
      await updateDoc(userRef, {
        trustScore,
        trustBadge,
        updatedAt: new Date().toISOString(),
      });
    }

    return { trustScore, trustBadge };
  },

  /**
   * Overspeed detection runner on trip completion
   */
  async evaluateTripOverspeed(
    tripId: string,
    vehicleRegNumber: string,
    saccoId: string,
    samples: GPSSample[],
    speedLimitKmH: number = 80
  ): Promise<number> {
    const violations = detectOverspeedViolations(samples, speedLimitKmH);
    let createdCount = 0;

    for (const v of violations) {
      const eventId = `viol_${tripId}_${Date.now()}_${createdCount}`;
      const ts = v.startTime ? Timestamp.fromDate(new Date(v.startTime)) : Timestamp.now();
      const currentAuthUser = auth?.currentUser;

      await setDoc(doc(db, 'violations', eventId), {
        id: eventId,
        ...(currentAuthUser?.uid ? { userId: currentAuthUser.uid } : {}),
        tripId,
        saccoId,
        vehicleRegNumber,
        recordedSpeedKmH: v.maxSpeedKmH,
        speedLimitKmH: v.speedLimitKmH,
        durationSec: v.durationSec,
        severity: v.maxSpeedKmH > 110 ? 'critical' : v.maxSpeedKmH > 95 ? 'high' : 'medium',
        status: 'pending',
        timestamp: ts,
        createdAt: Timestamp.now(),
      });

      // Trigger idempotent vehicle risk re-computation
      await this.computeVehicleRisk({
        eventId,
        vehicleRegNumber,
        saccoId,
        eventType: 'overspeed',
        severity: v.maxSpeedKmH > 110 ? 'critical' : v.maxSpeedKmH > 95 ? 'high' : 'medium',
        recordedSpeedKmH: v.maxSpeedKmH,
        speedLimitKmH: v.speedLimitKmH,
        timestamp: v.startTime,
      });

      createdCount++;
    }

    return createdCount;
  },

  /**
   * Universal Callable Invoker
   */
  async callCloudFunction<T = unknown>(functionName: string, data: Record<string, unknown>): Promise<T> {
    try {
      const callable = httpsCallable<Record<string, unknown>, T>(functions, functionName);
      const res = await callable(data);
      return res.data;
    } catch (err) {
      console.warn(`[functionsService] Cloud Function ${functionName} remote call failed, invoking local fallback:`, err);
      if (functionName === 'suspendUser') {
        const targetUid = data.targetUid as string;
        await updateDoc(doc(db, 'users', targetUid), {
          isActive: false,
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(collection(db, 'audit_logs')), {
          action: `SUSPEND_USER (${(data.reason as string) || 'Admin action'})`,
          actorName: 'System Admin',
          actorRole: 'admin',
          target: `User ID: ${targetUid}`,
          timestamp: new Date().toISOString(),
        });
        return { success: true, targetUid, isSuspended: true } as unknown as T;
      }
      if (functionName === 'reactivateUser') {
        const targetUid = data.targetUid as string;
        await updateDoc(doc(db, 'users', targetUid), {
          isActive: true,
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(collection(db, 'audit_logs')), {
          action: 'UNSUSPEND_USER',
          actorName: 'System Admin',
          actorRole: 'admin',
          target: `User ID: ${targetUid}`,
          timestamp: new Date().toISOString(),
        });
        return { success: true, targetUid, isSuspended: false } as unknown as T;
      }
      if (functionName === 'computeVehicleRisk') {
        return (await this.computeVehicleRisk(data as unknown as VehicleRiskEvent)) as unknown as T;
      }
      if (functionName === 'onVehicleClaimed') {
        return (await this.onVehicleClaimed(data.vehicleRegNumber as string, data.saccoId as string, data.saccoName as string)) as unknown as T;
      }
      if (functionName === 'syncPublicPins') {
        return (await this.syncPublicPins()) as unknown as T;
      }
      if (functionName === 'updateDailyAnalytics') {
        const dateStr = typeof data.dateStr === 'string' ? data.dateStr : new Date().toISOString().slice(0, 10);
        return (await this.updateDailyAnalytics(dateStr)) as unknown as T;
      }
      if (functionName === 'rebuildSaccoAnalytics') {
        return (await this.rebuildSaccoAnalytics(data.saccoId as string)) as unknown as T;
      }
      if (functionName === 'sendSOS') {
        return (await this.sendSOS(data as Parameters<typeof this.sendSOS>[0])) as unknown as T;
      }
      if (functionName === 'reportBlackSpot') {
        return (await this.reportBlackSpot(data as Parameters<typeof this.reportBlackSpot>[0])) as unknown as T;
      }
      throw err;
    }
  },

  /**
   * SEC-005: Client-side transactional rate limit enforcement fallback
   */
  async checkClientRateLimit(
    userId: string,
    action: 'sos' | 'black_spot',
    config: { maxAllowed: number; windowMs: number; errorMessage: string }
  ): Promise<void> {
    if (!userId || userId === 'anonymous') return;
    const rateLimitRef = doc(db, 'rate_limits', userId);
    try {
      const snap = await getDoc(rateLimitRef);
      const data = snap.exists() ? snap.data() || {} : {};
      const fieldKey = action === 'sos' ? 'sosTimestamps' : 'blackSpotTimestamps';
      const rawTimestamps: number[] = Array.isArray(data[fieldKey]) ? data[fieldKey] : [];
      const now = Date.now();
      const cutoff = now - config.windowMs;
      const validTimestamps = rawTimestamps.filter((ts) => typeof ts === 'number' && ts > cutoff);

      if (validTimestamps.length >= config.maxAllowed) {
        const err = new Error(config.errorMessage);
        (err as Error & { code?: string }).code = 'RATE_LIMIT_EXCEEDED';
        throw err;
      }

      validTimestamps.push(now);
      await setDoc(
        rateLimitRef,
        {
          userId,
          [fieldKey]: validTimestamps,
          updatedAt: new Date(now).toISOString(),
        },
        { merge: true }
      );
    } catch (e: unknown) {
      const errObj = e as { message?: string; code?: string };
      if (errObj.message?.includes('RATE_LIMIT_EXCEEDED') || errObj.code === 'RATE_LIMIT_EXCEEDED') {
        throw e;
      }
      console.warn('[functionsService] Client rate limit check warning:', e);
    }
  },

  /**
   * Gen 2 Function: reportBlackSpot (SEC-005)
   * Dispatches black-spot hazard report with server-enforced rate limiting (Max 10 per 24h).
   */
  async reportBlackSpot(payload: {
    id?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    hazardType?: string | undefined;
    severity?: string | undefined;
    locationName?: string | undefined;
    routeName?: string | undefined;
    county?: string | undefined;
    location?: { lat: number; lng: number } | undefined;
    photoUrl?: string | undefined;
    reportedByUid?: string | undefined;
    reportedByUserId?: string | undefined;
    reportedByDisplayName?: string | undefined;
    status?: string | undefined;
    corroborationsCount?: number | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
  }): Promise<{ success: boolean; spotId: string }> {
    try {
      const callable = httpsCallable<typeof payload, { success: boolean; spotId: string }>(functions, 'reportBlackSpot');
      const res = await callable(payload);
      return res.data;
    } catch (remoteErr: unknown) {
      const errObj = remoteErr as { message?: string; code?: string; details?: { code?: string } };
      if (
        errObj?.message?.includes('RATE_LIMIT_EXCEEDED') ||
        errObj?.code === 'resource-exhausted' ||
        errObj?.details?.code === 'RATE_LIMIT_EXCEEDED'
      ) {
        const err = new Error(errObj.message || 'RATE_LIMIT_EXCEEDED: Maximum 10 hazard reports permitted per 24 hours.');
        (err as Error & { code?: string }).code = 'RATE_LIMIT_EXCEEDED';
        throw err;
      }
      console.warn('[functionsService] Remote reportBlackSpot failed, executing client fallback:', remoteErr);

      const userId = payload.reportedByUid || 'passenger_me';
      await this.checkClientRateLimit(userId, 'black_spot', {
        maxAllowed: 10,
        windowMs: 24 * 60 * 60 * 1000,
        errorMessage: 'RATE_LIMIT_EXCEEDED: Maximum 10 hazard reports permitted per 24 hours.',
      });

      const spotId = payload.id || `bs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const lat = payload.location?.lat;
      const lng = payload.location?.lng;
      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        throw new Error('A valid location is required.');
      }

      const newReport = {
        id: spotId,
        spotId,
        title: payload.title || 'Road Hazard',
        name: payload.title || payload.locationName || 'Road Hazard',
        description: payload.description || '',
        hazardDescription: payload.description || payload.title || 'Road Hazard',
        hazardType: payload.hazardType || 'accident_prone',
        severity: payload.severity || 'high',
        locationName: payload.locationName || '',
        routeName: payload.routeName || payload.locationName || 'Kenyan Highway',
        county: payload.county || 'Nairobi',
        latitude: lat,
        longitude: lng,
        location: { lat, lng },
        photoUrl: payload.photoUrl || undefined,
        reportedByUid: userId,
        reportedByUserId: userId,
        reportedByDisplayName: payload.reportedByDisplayName || 'Commuter',
        status: 'pending',
        corroborationCount: 1,
        corroborationsCount: 1,
        confidenceScore: 0.8,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'black_spots', spotId), newReport, { merge: true });

      return { success: true, spotId };
    }
  },

  /**
   * Gen 2 Function: sendSOS (§9.6)
   * Dispatches emergency SMS to saved contacts, sends FCM push notification, and writes to safety_alerts.
   */
  async sendSOS(payload: {
    alertId?: string | undefined;
    tripId?: string | undefined;
    userId?: string | undefined;
    vehicleRegNumber?: string | undefined;
    saccoId?: string | undefined;
    location?: { lat: number; lng: number } | undefined;
    speedKmH?: number | undefined;
    message?: string | undefined;
  }): Promise<{
    success: boolean;
    alertId: string;
    contactsNotifiedCount: number;
    fcmDispatchedCount: number;
    dlqCount: number;
    contactsSummary: Array<{ name: string; relationship: string; status: 'dispatched' | 'failed' }>;
  }> {
    try {
      const callable = httpsCallable<typeof payload, {
        success: boolean;
        alertId: string;
        contactsNotifiedCount: number;
        fcmDispatchedCount: number;
        dlqCount: number;
        contactsSummary: Array<{ name: string; relationship: string; status: 'dispatched' | 'failed' }>;
      }>(functions, 'sendSOS');
      const res = await callable(payload);
      return res.data;
    } catch (remoteErr: unknown) {
      const errObj = remoteErr as { message?: string; code?: string; details?: { code?: string } };
      if (
        errObj?.message?.includes('RATE_LIMIT_EXCEEDED') ||
        errObj?.code === 'resource-exhausted' ||
        errObj?.details?.code === 'RATE_LIMIT_EXCEEDED'
      ) {
        const err = new Error(errObj.message || 'RATE_LIMIT_EXCEEDED: Maximum 3 SOS alerts permitted per hour.');
        (err as Error & { code?: string }).code = 'RATE_LIMIT_EXCEEDED';
        throw err;
      }
      console.warn('[functionsService] Remote sendSOS failed or offline, executing client fallback:', remoteErr);

      const userId = payload.userId || 'passenger_me';
      await this.checkClientRateLimit(userId, 'sos', {
        maxAllowed: 3,
        windowMs: 60 * 60 * 1000,
        errorMessage: 'RATE_LIMIT_EXCEEDED: Maximum 3 SOS alerts permitted per hour.',
      });

      const alertId = payload.alertId || `sos_${Date.now()}`;
      const userRef = doc(db, 'users', userId);
      let emergencyContacts: Array<{ name: string; relationship: string; phone?: string }> = [];
      try {
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data() || {};
        emergencyContacts = userData.emergencyContacts || [];
      } catch (userErr) {
        console.warn('[functionsService] Unable to load emergency contacts in client fallback:', userErr);
      }

      const contactsSummary: Array<{ name: string; relationship: string; status: 'dispatched' | 'failed' }> = [];
      for (const c of emergencyContacts) {
        contactsSummary.push({
          name: c.name,
          relationship: c.relationship,
          status: 'failed',
        });
      }

      // Save alert to safety_alerts
      const alertData: Record<string, unknown> = {
        id: alertId,
        tripId: payload.tripId || `trip_${alertId}`,
        userId,
        vehicleRegNumber: payload.vehicleRegNumber || 'Vehicle In Transit',
        saccoId: payload.saccoId || 'unassigned',
        type: 'sos',
        severity: 'critical',
        message: payload.message || 'Emergency SOS activated by passenger',
        speedKmH: payload.speedKmH ?? 0,
        timestamp: new Date().toISOString(),
        status: 'active',
        emergencyContactsCount: emergencyContacts.length,
      };

      if (payload.location && typeof payload.location.lat === 'number' && typeof payload.location.lng === 'number') {
        alertData.latitude = payload.location.lat;
        alertData.longitude = payload.location.lng;
        alertData.location = payload.location;
      }

      try {
        await setDoc(doc(db, 'safety_alerts', alertId), alertData, { merge: true });
      } catch (saveErr) {
        console.warn('[functionsService] Local fallback save safety_alerts warning:', saveErr);
      }

      return {
        success: false,
        alertId,
        contactsNotifiedCount: 0,
        fcmDispatchedCount: 0,
        dlqCount: 0,
        contactsSummary,
      };
    }
  },
};
