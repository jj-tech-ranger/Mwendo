"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVehicleRisk = void 0;
exports.processVehicleRiskLogic = processVehicleRiskLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const engine_1 = require("../lib/engine");
async function processVehicleRiskLogic(db, event) {
    const ledgerRef = db.collection('processedEvents').doc(event.eventId);
    // Use a Firestore transaction for atomic idempotency check and write
    const shouldProcess = await db.runTransaction(async (transaction) => {
        const ledgerSnap = await transaction.get(ledgerRef);
        if (ledgerSnap.exists) {
            return false;
        }
        transaction.set(ledgerRef, {
            eventId: event.eventId,
            handler: 'computeVehicleRisk',
            vehicleRegNumber: event.vehicleRegNumber,
            processedAt: new Date().toISOString(),
        });
        return true;
    });
    if (!shouldProcess) {
        return { processed: false, riskScore: 0, riskTier: 'existing' };
    }
    const vehicleId = event.vehicleId || event.vehicleRegNumber.replace(/\s+/g, '_');
    const vehicleRef = db.collection('vehicles').doc(vehicleId);
    const vehicleSnap = await vehicleRef.get();
    if (!vehicleSnap.exists) {
        await vehicleRef.set({
            id: vehicleId,
            regNumber: event.vehicleRegNumber,
            saccoId: event.saccoId || 'unassigned',
            saccoName: event.saccoId === 'unassigned' ? 'Independent / Unassigned' : event.saccoId,
            capacity: 14,
            status: 'active',
            isProvisional: true,
            riskScore: 85,
            riskTier: 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
    // Query violations with bounded limit to prevent unbounded collection scans
    const violSnap = await db
        .collection('violations')
        .where('vehicleRegNumber', '==', event.vehicleRegNumber)
        .limit(200)
        .get();
    const nowMs = Date.now();
    const eventsList = violSnap.docs
        .map((d) => {
        const data = d.data();
        return {
            severity: (data.severity || 'low'),
            timestamp: data.timestamp || new Date().toISOString(),
            confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 1.0,
            recordedSpeedKmH: typeof data.recordedSpeedKmH === 'number' ? data.recordedSpeedKmH : undefined,
        };
    })
        .filter((e) => {
        // VT-003: Plausibility checks - discard physically impossible speeds (>180 km/h) or invalid timestamps
        if (e.recordedSpeedKmH !== undefined && (e.recordedSpeedKmH < 0 || e.recordedSpeedKmH > 180)) {
            return false;
        }
        const t = new Date(e.timestamp).getTime();
        return Number.isFinite(t);
    });
    // Validate incoming event plausibility
    const incomingTimeMs = new Date(event.timestamp).getTime();
    if (Number.isFinite(incomingTimeMs) &&
        (event.recordedSpeedKmH === undefined || (event.recordedSpeedKmH >= 0 && event.recordedSpeedKmH <= 180))) {
        eventsList.push({
            severity: event.severity,
            timestamp: event.timestamp,
            confidenceScore: typeof event.confidenceScore === 'number' ? event.confidenceScore : 1.0,
        });
    }
    // Query trips count with limit
    const tripsSnap = await db
        .collection('trips')
        .where('vehicleRegNumber', '==', event.vehicleRegNumber)
        .limit(100)
        .get();
    const totalTripCount = tripsSnap.size || 1;
    const { riskScore, riskTier } = (0, engine_1.calculateVehicleRiskScore)(eventsList, totalTripCount, nowMs);
    // Update vehicle score (Admin SDK bypasses Security Rules)
    await vehicleRef.set({
        riskScore,
        riskTier,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
    // Record audit log
    await db.collection('audit_logs').add({
        action: 'COMPUTE_VEHICLE_RISK',
        actorName: 'System (Cloud Function)',
        actorRole: 'system',
        target: event.vehicleRegNumber,
        saccoId: event.saccoId,
        timestamp: new Date().toISOString(),
        details: { eventId: event.eventId, riskScore, riskTier, totalEvents: eventsList.length },
    });
    return { processed: true, riskScore, riskTier };
}
exports.computeVehicleRisk = (0, https_1.onCall)({ enforceAppCheck: process.env.NODE_ENV === 'production' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const event = request.data;
    if (!event || !event.eventId || !event.vehicleRegNumber) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required event fields.');
    }
    // Role and tenancy authorization check
    const role = (request.auth.token?.activeRole || request.auth.token?.role || 'passenger');
    const userSaccoId = request.auth.token?.saccoId;
    if (role === 'sacco_manager' && userSaccoId && event.saccoId && userSaccoId !== event.saccoId) {
        throw new https_1.HttpsError('permission-denied', 'Cannot compute risk for a different SACCO.');
    }
    const db = (0, firestore_1.getFirestore)();
    return await processVehicleRiskLogic(db, event);
});
//# sourceMappingURL=computeVehicleRisk.js.map