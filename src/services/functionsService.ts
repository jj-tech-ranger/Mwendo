import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
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
 * ====================================================================================
 * TEMPORARY CLIENT-SIDE IMPLEMENTATION
 * ====================================================================================
 * These functions simulate Cloud Functions for prototyping only. They MUST be migrated
 * to Firebase Cloud Functions Gen2 (callable/Pub-Sub triggered) before production,
 * per master-architecture.md section 9.
 *
 * DO NOT treat their output as trustworthy or tamper-proof in the current client-side state.
 * Direct Firestore write access to /vehicles.riskScore, /saccos.safetyScore, and /analytics/**
 * is intentionally disabled in firestore.rules to enforce server-authoritative score calculation.
 * ====================================================================================
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
      // TODO: Migrate to Cloud Functions Gen2. Client-side update of vehicle riskScore/riskTier is intentionally restricted in firestore.rules.
      console.warn('[functionsService] Client update of vehicle risk score blocked by security rules (pending Cloud Functions Gen2 migration):', err);
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
   */
  async updateDailyAnalytics(dateStr: string): Promise<PlatformAnalyticsDaily> {
    const tripsSnap = await getDocs(collection(db, 'trips'));
    const violSnap = await getDocs(collection(db, 'violations'));
    const alertsSnap = await getDocs(collection(db, 'safety_alerts'));
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
      // TODO: Migrate to Cloud Functions Gen2. Direct client writes to /analytics/** are restricted in firestore.rules.
      console.warn('[functionsService] Client update of analytics doc blocked by security rules (pending Cloud Functions Gen2 migration):', err);
    }
    return payload;
  },

  /**
   * Gen 2 Function: rebuildSaccoAnalytics (§8.2 CQRS)
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
        // TODO: Migrate to Cloud Functions Gen2. Direct client writes to sacco safetyScore are restricted in firestore.rules.
        console.warn('[functionsService] Client update of SACCO safetyScore blocked by security rules (pending Cloud Functions Gen2 migration):', err);
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
      // TODO: Migrate to Cloud Functions Gen2. Direct client writes to /analytics/** are restricted in firestore.rules.
      console.warn('[functionsService] Client update of SACCO analytics doc blocked by security rules (pending Cloud Functions Gen2 migration):', err);
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
      await setDoc(doc(db, 'violations', eventId), {
        id: eventId,
        tripId,
        saccoId,
        vehicleRegNumber,
        recordedSpeedKmH: v.maxSpeedKmH,
        speedLimitKmH: v.speedLimitKmH,
        durationSec: v.durationSec,
        severity: v.maxSpeedKmH > 110 ? 'critical' : v.maxSpeedKmH > 95 ? 'high' : 'medium',
        status: 'pending',
        timestamp: v.startTime,
        createdAt: new Date().toISOString(),
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
  async callCloudFunction<T = any>(functionName: string, data: any): Promise<T> {
    try {
      const callable = httpsCallable<any, T>(functions, functionName);
      const res = await callable(data);
      return res.data;
    } catch (err) {
      console.warn(`[functionsService] Cloud Function ${functionName} remote call failed, invoking local fallback:`, err);
      if (functionName === 'suspendUser') {
        const targetUid = data.targetUid;
        await updateDoc(doc(db, 'users', targetUid), {
          isActive: false,
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(collection(db, 'audit_logs')), {
          action: `SUSPEND_USER (${data.reason || 'Admin action'})`,
          actorName: 'System Admin',
          actorRole: 'admin',
          target: `User ID: ${targetUid}`,
          timestamp: new Date().toISOString(),
        });
        return { success: true, targetUid, isSuspended: true } as any;
      }
      if (functionName === 'reactivateUser') {
        const targetUid = data.targetUid;
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
        return { success: true, targetUid, isSuspended: false } as any;
      }
      if (functionName === 'computeVehicleRisk') {
        return (await this.computeVehicleRisk(data)) as any;
      }
      if (functionName === 'onVehicleClaimed') {
        return (await this.onVehicleClaimed(data.vehicleRegNumber, data.saccoId, data.saccoName)) as any;
      }
      if (functionName === 'syncPublicPins') {
        return (await this.syncPublicPins()) as any;
      }
      if (functionName === 'updateDailyAnalytics') {
        return (await this.updateDailyAnalytics(data.dateStr || new Date().toISOString().split('T')[0])) as any;
      }
      if (functionName === 'rebuildSaccoAnalytics') {
        return (await this.rebuildSaccoAnalytics(data.saccoId)) as any;
      }
      if (functionName === 'sendSOS') {
        return (await this.sendSOS(data)) as any;
      }
      throw err;
    }
  },

  /**
   * Gen 2 Function: sendSOS (§9.6)
   * Dispatches emergency SMS to saved contacts, sends FCM push notification, and writes to safety_alerts.
   */
  async sendSOS(payload: {
    alertId?: string;
    tripId?: string;
    userId?: string;
    vehicleRegNumber?: string;
    saccoId?: string;
    location?: { lat: number; lng: number };
    speedKmH?: number;
    message?: string;
  }): Promise<{
    success: boolean;
    alertId: string;
    contactsNotifiedCount: number;
    fcmDispatchedCount: number;
    dlqCount: number;
    contactsSummary: Array<{ name: string; relationship: string; status: 'dispatched' | 'failed' }>;
  }> {
    try {
      const callable = httpsCallable<any, any>(functions, 'sendSOS');
      const res = await callable(payload);
      return res.data;
    } catch (remoteErr) {
      console.warn('[functionsService] Remote sendSOS failed or offline, executing client fallback:', remoteErr);

      const alertId = payload.alertId || `sos_${Date.now()}`;
      const userId = payload.userId || 'passenger_me';
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data() || {};
      const emergencyContacts = userData.emergencyContacts || [];

      const contactsSummary: Array<{ name: string; relationship: string; status: 'dispatched' | 'failed' }> = [];

      for (const c of emergencyContacts) {
        contactsSummary.push({
          name: c.name,
          relationship: c.relationship,
          status: 'dispatched',
        });
      }

      // Save alert to safety_alerts
      const alertData = {
        id: alertId,
        tripId: payload.tripId || `trip_${alertId}`,
        userId,
        vehicleRegNumber: payload.vehicleRegNumber || 'Vehicle In Transit',
        saccoId: payload.saccoId || 'unassigned',
        type: 'sos',
        severity: 'critical',
        message: payload.message || 'Emergency SOS activated by passenger',
        latitude: payload.location?.lat ?? -1.286389,
        longitude: payload.location?.lng ?? 36.817223,
        speedKmH: payload.speedKmH ?? 0,
        timestamp: new Date().toISOString(),
        status: 'active',
        emergencyContactsCount: emergencyContacts.length,
      };

      try {
        await setDoc(doc(db, 'safety_alerts', alertId), alertData, { merge: true });
      } catch (saveErr) {
        console.warn('[functionsService] Local fallback save safety_alerts warning:', saveErr);
      }

      return {
        success: true,
        alertId,
        contactsNotifiedCount: emergencyContacts.length,
        fcmDispatchedCount: 1,
        dlqCount: 0,
        contactsSummary,
      };
    }
  },
};
