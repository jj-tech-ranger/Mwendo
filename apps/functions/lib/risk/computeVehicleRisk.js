"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVehicleRisk = void 0;
exports.processVehicleRiskLogic = processVehicleRiskLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const engine_1 = require("../lib/engine");
async function processVehicleRiskLogic(db, event) {
    const ledgerRef = db.collection('processedEvents').doc(event.eventId);
    const ledgerSnap = await ledgerRef.get();
    if (ledgerSnap.exists) {
        return { processed: false, riskScore: 0, riskTier: 'existing' };
    }
    // Mark event as processed in ledger
    await ledgerRef.set({
        eventId: event.eventId,
        handler: 'computeVehicleRisk',
        vehicleRegNumber: event.vehicleRegNumber,
        processedAt: new Date().toISOString(),
    });
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
    // Query violations
    const violSnap = await db
        .collection('violations')
        .where('vehicleRegNumber', '==', event.vehicleRegNumber)
        .get();
    const eventsList = violSnap.docs.map((d) => {
        const data = d.data();
        return {
            severity: (data.severity || 'low'),
            timestamp: data.timestamp || new Date().toISOString(),
            confidenceScore: typeof data.confidenceScore === 'number' ? data.confidenceScore : 1.0,
        };
    });
    eventsList.push({
        severity: event.severity,
        timestamp: event.timestamp,
        confidenceScore: typeof event.confidenceScore === 'number' ? event.confidenceScore : 1.0,
    });
    // Query trips count
    const tripsSnap = await db
        .collection('trips')
        .where('vehicleRegNumber', '==', event.vehicleRegNumber)
        .get();
    const totalTripCount = tripsSnap.size || 1;
    const { riskScore, riskTier } = (0, engine_1.calculateVehicleRiskScore)(eventsList, totalTripCount);
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
exports.computeVehicleRisk = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const event = request.data;
    if (!event || !event.eventId || !event.vehicleRegNumber) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required event fields.');
    }
    const db = (0, firestore_1.getFirestore)();
    return await processVehicleRiskLogic(db, event);
});
//# sourceMappingURL=computeVehicleRisk.js.map