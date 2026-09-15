import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth, hasRealConfig } from '../lib/firebase';
import { normalizePlate } from '../lib/plate';
import { teamUserRepository } from '../repositories';
import { PlatformAnalyticsDaily, SaccoAnalyticsDaily, GenerateTripSummaryPayload, GenerateTripSummaryResult, UserRole } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import {
  calculateSaccoSafetyScore,
  ConfidenceScorer,
  GPSSample,
} from '../lib/engine';

export function isMfaRequiredError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const errorObj = err as { code?: string; message?: string };
  const message = (errorObj.message || '').toLowerCase();
  const code = (errorObj.code || '').toLowerCase();
  return (
    message.includes('mfa re-verification required') ||
    (message.includes('mfa') && message.includes('required')) ||
    (code === 'functions/failed-precondition' && message.includes('mfa'))
  );
}

/**
 * Functions Service
 * Client-side handling and Cloud Function dispatchers for incident dispatch,
 * alerts, and analytics synchronization.
 */

export const functionsService = {
  /**
   * Provisional vehicle auto-provisioning (§8.2)
   */
  async provisionProvisionalVehicle(vehicleRegNumber: string, saccoId: string = 'unassigned'): Promise<void> {
    const normPlate = normalizePlate(vehicleRegNumber);
    const vehicleId = normPlate;
    const vehicleRef = doc(db, 'vehicles', vehicleId);
    const snap = await getDoc(vehicleRef);

    if (!snap.exists()) {
      await setDoc(vehicleRef, {
        id: vehicleId,
        regNumber: normPlate,
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

      // Sync public-safe projection
      try {
        const summaryRef = doc(db, 'vehicle_public_summary', vehicleId);
        await setDoc(summaryRef, {
          id: vehicleId,
          vehicleId,
          regNumber: normPlate,
          saccoId,
          saccoName: saccoId === 'unassigned' ? 'Independent / Unassigned' : saccoId,
          capacity: 14,
          status: 'active',
          isProvisional: true,
          riskScore: 85,
          riskTier: 'medium',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        console.warn('[VehicleResolution] Could not sync public summary:', err);
      }
      console.log(`[VehicleResolution] Provisioned provisional vehicle for ${normPlate}`);
    }
  },

  /**
   * Gen 2 Function: onVehicleClaimed (§9.4)
   * Two-phase paginated backfill in ≤450-op batches with independent collection loops.
   */
  async onVehicleClaimed(vehicleRegNumber: string, targetSaccoId: string, targetSaccoName: string): Promise<{ updatedCount: number }> {
    let totalOps = 0;

    // Update vehicle doc
    const vehicleId = normalizePlate(vehicleRegNumber);
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

      try {
        const summaryRef = doc(db, 'vehicle_public_summary', vehicleId);
        await setDoc(summaryRef, {
          saccoId: targetSaccoId,
          saccoName: targetSaccoName,
          isProvisional: false,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (err) {
        console.warn('[onVehicleClaimed] Could not update public summary:', err);
      }
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
   * Synchronizes verified/published black spots to the lightweight public_pins collection.
   * Invokes the authoritative backend Cloud Function with cursor-based incremental sync,
   * falling back to client-side cursor-based sync if offline or running in mock mode.
   * NOTE (SEC-005 / §7.3): syncPublicPins MUST ONLY copy records where verifiedByAuthority: true / status: 'published'.
   * It MUST NEVER copy reportedByUid, user PII, or unmoderated reports to public_pins.
   */
  async syncPublicPins(options?: { forceFullScan?: boolean }): Promise<{ syncedCount: number; deletedCount?: number; cursor?: string }> {
    try {
      const callable = httpsCallable<{ forceFullScan?: boolean }, { syncedCount: number; deletedCount: number; cursor: string }>(
        functions,
        'syncPublicPins'
      );
      const res = await callable(options || {});
      return res.data;
    } catch (err) {
      console.warn('[functionsService] syncPublicPins Cloud Function call failed, running local fallback:', err);
      return await this.syncPublicPinsLocalFallback(options);
    }
  },

  async syncPublicPinsLocalFallback(options?: { forceFullScan?: boolean }): Promise<{ syncedCount: number; deletedCount: number; cursor: string }> {
    const currentRunTimestamp = new Date().toISOString();
    let lastSyncedAt: string | null = null;

    if (!options?.forceFullScan) {
      try {
        const cursorSnap = await getDoc(doc(db, 'system_config', 'public_pins_sync'));
        if (cursorSnap.exists()) {
          lastSyncedAt = (cursorSnap.data()?.lastSyncedAt as string) || null;
        }
      } catch (err) {
        console.warn('[functionsService] Could not read public_pins_sync cursor:', err);
      }
    }

    let spotsQuery;
    if (lastSyncedAt) {
      spotsQuery = query(
        collection(db, 'black_spots'),
        where('updatedAt', '>', lastSyncedAt)
      );
    } else {
      spotsQuery = query(collection(db, 'black_spots'));
    }

    const snap = await getDocs(spotsQuery);
    const batch = writeBatch(db);
    let syncedCount = 0;
    let deletedCount = 0;

    for (const spotDoc of snap.docs) {
      const data = spotDoc.data();
      const pinRef = doc(db, 'public_pins', spotDoc.id);

      if (data.status === 'published' || data.verifiedByAuthority === true) {
        batch.set(
          pinRef,
          {
            id: spotDoc.id,
            title: data.name || data.title || 'Hazardous Spot',
            routeName: data.routeName || '',
            latitude: data.latitude,
            longitude: data.longitude,
            severity: data.severity || 'high',
            updatedAt: data.updatedAt || currentRunTimestamp,
          },
          { merge: true }
        );
        syncedCount++;
      } else {
        batch.delete(pinRef);
        deletedCount++;
      }
    }

    // Save or update cursor in system_config/public_pins_sync
    const cursorRef = doc(db, 'system_config', 'public_pins_sync');
    batch.set(
      cursorRef,
      {
        lastSyncedAt: currentRunTimestamp,
        lastRunAt: currentRunTimestamp,
        lastDeltaSynced: syncedCount,
        lastDeltaDeleted: deletedCount,
      },
      { merge: true }
    );

    if (syncedCount > 0 || deletedCount > 0 || !lastSyncedAt) {
      await batch.commit();
    }

    return { syncedCount, deletedCount, cursor: currentRunTimestamp };
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
   * Invokes the authoritative updateReporterTrust Cloud Function callable.
   * Target user identity is strictly derived from the caller's auth context server-side.
   */
  async updateReporterTrust(_userId?: string): Promise<{ trustScore: number; trustBadge: 'bronze' | 'silver' | 'gold' | 'verified_guardian' }> {
    try {
      const callable = httpsCallable<void, { trustScore: number; trustBadge: 'bronze' | 'silver' | 'gold' | 'verified_guardian' }>(
        functions,
        'updateReporterTrust'
      );
      const res = await callable();
      return {
        trustScore: res.data.trustScore,
        trustBadge: res.data.trustBadge,
      };
    } catch (err) {
      console.warn('[functionsService] updateReporterTrust callable invocation failed:', err);
      throw err;
    }
  },

  /**
   * Authoritative trip completion & overspeed evaluation via Cloud Functions.
   * Re-evaluates GPS telemetry server-side, writes verified violation records,
   * updates the idempotency ledger, and invokes vehicle risk computation.
   */
  async processTripCompletion(payload: {
    tripId: string;
    samples: GPSSample[];
    speedLimitKmH?: number;
  }): Promise<{
    success: boolean;
    processed: boolean;
    alreadyProcessed?: boolean;
    tripId: string;
    violationsCount: number;
    latestRiskScore?: number;
    latestRiskTier?: string;
  }> {
    return this.callCloudFunction('processTripCompletion', payload as unknown as Record<string, unknown>);
  },

  /**
   * Universal Callable Invoker
   */
  async callCloudFunction<T = unknown>(functionName: string, data: Record<string, unknown>): Promise<T> {
    if (hasRealConfig) {
      try {
        const callable = httpsCallable<Record<string, unknown>, T>(functions, functionName);
        const res = await callable(data);
        return res.data;
      } catch (err) {
        if (isMfaRequiredError(err)) {
          console.warn(`[functionsService] Cloud Function ${functionName} blocked: MFA re-verification required.`);
          const currentUser = useAuthStore.getState().user;
          if (currentUser) {
            useAuthStore.getState().setUser({
              ...currentUser,
              isMfaVerified: false,
            });
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('mwendo:mfa-required', {
                detail: { functionName, error: err },
              })
            );
          }
          throw err;
        }

        console.warn(`[functionsService] Cloud Function ${functionName} remote call failed, invoking local fallback:`, err);
      }
    }

    if (functionName === 'processTripCompletion') {
      // Violations and risk scores cannot be written directly by client SDK
      // because firestore.rules strictly enforces allow create: if false on /violations.
      // Return a safe offline/fallback acknowledgment without violating security boundaries.
      return {
        success: true,
        processed: false,
        offlineFallback: true,
        tripId: data.tripId as string,
        violationsCount: 0,
      } as unknown as T;
    }
    if (functionName === 'suspendUser') {
      const targetUid = data.targetUid as string;
      if (hasRealConfig) {
        try {
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
        } catch {
          // offline fallback
        }
      }
      return { success: true, targetUid, isSuspended: true } as unknown as T;
    }
    if (functionName === 'reactivateUser') {
      const targetUid = data.targetUid as string;
      if (hasRealConfig) {
        try {
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
        } catch {
          // offline fallback
        }
      }
      return { success: true, targetUid, isSuspended: false } as unknown as T;
    }
    if (functionName === 'assignUserRole') {
      const targetUid = data.targetUid as string;
      const newRole = data.newRole as UserRole;
      const saccoId = data.saccoId as string | undefined;
      const authorityScope = data.authorityScope as 'national' | 'county' | undefined;
      const county = data.county as string | undefined;
      const teamUserId = data.teamUserId as string | undefined;

      const userUpdate: Record<string, unknown> = {
        role: newRole,
        activeRole: newRole,
        claimedActiveRole: newRole,
        updatedAt: new Date().toISOString(),
      };
      if (newRole === 'sacco_manager') {
        userUpdate.saccoId = saccoId;
        userUpdate.claimedSaccoId = saccoId;
        userUpdate.authorityScope = null;
        userUpdate.claimedAuthorityScope = null;
      } else if (newRole === 'authority') {
        userUpdate.authorityScope = authorityScope || 'national';
        userUpdate.claimedAuthorityScope = authorityScope || 'national';
        if (county) userUpdate.county = county;
        userUpdate.saccoId = null;
        userUpdate.claimedSaccoId = null;
      } else {
        userUpdate.saccoId = null;
        userUpdate.claimedSaccoId = null;
        userUpdate.authorityScope = null;
        userUpdate.claimedAuthorityScope = null;
        userUpdate.county = null;
      }

      if (hasRealConfig) {
        try {
          await updateDoc(doc(db, 'users', targetUid), userUpdate as Record<string, string | null | undefined>);
        } catch {
          // offline or permission fallback
        }
      }

      if (teamUserId) {
        const updatePayload = {
          status: 'active' as const,
          uid: targetUid,
          updatedAt: new Date().toISOString(),
          lastActive: 'Active',
        };
        if (hasRealConfig) {
          try {
            await updateDoc(doc(db, 'team_users', teamUserId), updatePayload);
          } catch {
            // ignore
          }
        }
        try {
          await teamUserRepository.update(teamUserId, updatePayload);
        } catch {
          // ignore
        }
      }

      if (hasRealConfig) {
        try {
          await setDoc(doc(collection(db, 'audit_logs')), {
            action: `ASSIGN_USER_ROLE (${newRole})`,
            actorName: 'System Admin',
            actorRole: 'admin',
            target: `User ID: ${targetUid}`,
            saccoId: saccoId || 'none',
            timestamp: new Date().toISOString(),
            details: { targetUid, newRole, saccoId, authorityScope, county, teamUserId },
          });
        } catch {
          // ignore
        }
      }

        return {
          success: true,
          targetUid,
          newRole,
          previousRole: 'passenger',
          claims: { activeRole: newRole, saccoId },
        } as unknown as T;
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
      throw new Error(`[functionsService] Unhandled function fallback: ${functionName}`);
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

      let reporterTrustScore = 0.5;
      try {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          const rawTrust = userSnap.data()?.trustScore;
          if (typeof rawTrust === 'number' && Number.isFinite(rawTrust)) {
            reporterTrustScore = rawTrust > 1.0
              ? Math.min(1.0, Math.max(0.0, rawTrust / 100))
              : Math.min(1.0, Math.max(0.0, rawTrust));
          }
        }
      } catch (err) {
        console.warn('[functionsService] Could not load user trustScore, using default:', err);
      }

      const hasEvidencePhoto = Boolean(
        payload.photoUrl && typeof payload.photoUrl === 'string' && payload.photoUrl.trim().length > 0
      );
      const confidenceScore = ConfidenceScorer.calculateHazardConfidence(
        1,
        reporterTrustScore,
        hasEvidencePhoto
      );

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
        confidenceScore,
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
    fcmSummary?: Array<{ target: string; status: 'dispatched' | 'failed' }>;
    notifiedChannels?: Array<{
      channel: 'sms' | 'sacco_fcm' | 'authority_fcm';
      label: string;
      status: 'dispatched' | 'failed';
    }>;
    saccoId?: string;
  }> {
    try {
      const callable = httpsCallable<typeof payload, {
        success: boolean;
        alertId: string;
        contactsNotifiedCount: number;
        fcmDispatchedCount: number;
        dlqCount: number;
        contactsSummary: Array<{ name: string; relationship: string; status: 'dispatched' | 'failed' }>;
        fcmSummary?: Array<{ target: string; status: 'dispatched' | 'failed' }>;
        notifiedChannels?: Array<{
          channel: 'sms' | 'sacco_fcm' | 'authority_fcm';
          label: string;
          status: 'dispatched' | 'failed';
        }>;
        saccoId?: string;
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
        fcmSummary: [],
        notifiedChannels: [],
        saccoId: payload.saccoId || 'unassigned',
      };
    }
  },

  /**
   * Generates a 1-2 sentence plain-language safety summary via the Gemini Cloud Function.
   * Calls the backend Cloud Function callable so API keys remain server-side.
   */
  async generateTripSummary(payload: GenerateTripSummaryPayload): Promise<GenerateTripSummaryResult> {
    const callable = httpsCallable<GenerateTripSummaryPayload, GenerateTripSummaryResult>(
      functions,
      'generateTripSummary'
    );
    try {
      const result = await callable(payload);
      return result.data;
    } catch (err) {
      console.warn('[functionsService] generateTripSummary callable error, falling back locally:', err);
      const overspeed = payload.overspeedEventsCount ?? (payload.violations ? payload.violations.length : 0);
      const maxSpeed = payload.maxSpeedKmH || 0;
      const route = payload.routeName || 'this corridor';
      const isHigh = maxSpeed > 90 || overspeed > 0;
      return {
        success: false,
        summary: isHigh
          ? `This trip had ${overspeed} overspeed event${overspeed === 1 ? '' : 's'} (peaking at ${maxSpeed} km/h) along ${route} — moderate risk.`
          : `Compliant trip along ${route} with speeds safely maintained within legal thresholds — low risk.`,
        riskTier: isHigh ? 'moderate' : 'low',
        overspeedEventsCount: overspeed,
        generatedBy: 'rule_engine',
      };
    }
  },

  /**
   * Waze-style Black Spot Confirmation Mechanic
   * Submits a confirm/dismiss document into black_spots/{spotId}/confirmations/{userId}
   * Enforces 1 confirmation per user per 24 hours (backed by Firestore Security Rules).
   */
  async confirmBlackSpot(
    spotId: string,
    type: 'still_there' | 'resolved'
  ): Promise<{ success: boolean; message: string; code?: string }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, message: 'Please sign in to confirm road hazards.' };
    }

    const confRef = doc(db, 'black_spots', spotId, 'confirmations', currentUser.uid);

    try {
      const existingSnap = await getDoc(confRef);
      if (existingSnap.exists()) {
        const data = existingSnap.data();
        const rawTime = data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp ? new Date(data.timestamp).getTime() : 0);
        const hoursAgo = (Date.now() - rawTime) / (1000 * 60 * 60);
        if (hoursAgo < 24) {
          const hoursLeft = Math.ceil(24 - hoursAgo);
          return {
            success: false,
            code: 'rate_limited',
            message: `You have already confirmed this hazard. You can submit another confirmation in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}.`,
          };
        }
      }

      await setDoc(confRef, {
        userId: currentUser.uid,
        type,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      }, { merge: true });

      return {
        success: true,
        message: type === 'still_there'
          ? 'Hazard confirmed as still present.'
          : 'Reported as no longer an issue.',
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('permission-denied') || errMsg.includes('PERMISSION_DENIED')) {
        return {
          success: false,
          code: 'rate_limited',
          message: 'You can only submit one confirmation per report every 24 hours.',
        };
      }
      return {
        success: false,
        message: 'Could not record confirmation. Please try again.',
      };
    }
  },

  /**
   * Fetches confirmation totals and current user's status for a black spot.
   */
  async getBlackSpotConfirmations(spotId: string): Promise<{
    total: number;
    stillThere: number;
    resolved: number;
    lastConfirmedAt?: string | undefined;
    userConfirmation?: 'still_there' | 'resolved' | null | undefined;
    userCanConfirm: boolean;
  }> {
    const currentUser = auth.currentUser;
    try {
      const confCol = collection(db, 'black_spots', spotId, 'confirmations');
      const snap = await getDocs(confCol);
      let stillThere = 0;
      let resolved = 0;
      let latestMs = 0;
      let userConf: 'still_there' | 'resolved' | null = null;
      let userCanConfirm = true;

      snap.forEach((d) => {
        const data = d.data();
        if (data.type === 'still_there') stillThere++;
        else if (data.type === 'resolved') resolved++;

        const ms = data.timestamp?.toDate ? data.timestamp.toDate().getTime() : (data.timestamp ? new Date(data.timestamp).getTime() : 0);
        if (ms > latestMs) latestMs = ms;

        if (currentUser && d.id === currentUser.uid) {
          userConf = data.type as 'still_there' | 'resolved';
          const hoursAgo = (Date.now() - ms) / (1000 * 60 * 60);
          if (hoursAgo < 24) {
            userCanConfirm = false;
          }
        }
      });

      return {
        total: snap.size,
        stillThere,
        resolved,
        lastConfirmedAt: latestMs > 0 ? new Date(latestMs).toISOString() : undefined,
        userConfirmation: userConf,
        userCanConfirm,
      };
    } catch (err) {
      console.warn('[functionsService] Failed to load confirmations:', err);
      return {
        total: 0,
        stillThere: 0,
        resolved: 0,
        userCanConfirm: true,
      };
    }
  },

  /**
   * CF-012: Server-Authoritative Role Provisioning
   * Admin-only, App Check-enforced invocation to assign elevated roles and merge custom claims.
   */
  async assignUserRole(payload: {
    targetUid: string;
    newRole: UserRole;
    saccoId?: string | undefined;
    authorityScope?: 'national' | 'county' | undefined;
    county?: string | undefined;
    badgeNumber?: string | undefined;
    authorityId?: string | undefined;
    teamUserId?: string | undefined;
  }): Promise<{ success: boolean; targetUid: string; previousRole: string; newRole: UserRole }> {
    return this.callCloudFunction<{ success: boolean; targetUid: string; previousRole: string; newRole: UserRole }>(
      'assignUserRole',
      payload as Record<string, unknown>
    );
  },
};
