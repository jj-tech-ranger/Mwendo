"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInspection = void 0;
exports.processCreateInspectionLogic = processCreateInspectionLogic;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const env_1 = require("../lib/env");
const CERTIFICATE_VALIDITY_DAYS = 365;
function requireNonEmptyString(value, field) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new https_1.HttpsError('invalid-argument', `${field} is required.`);
    }
    return value.trim();
}
function resolveAuthorityRole(token) {
    return String(token?.activeRole || token?.role || '');
}
function generateCertificateNumber(inspectionId, now) {
    const year = now.getUTCFullYear();
    const suffix = inspectionId.replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
    return `MWD-${year}-${suffix}`;
}
async function processCreateInspectionLogic(db, payload, inspectorId, inspectorRole) {
    if (inspectorRole !== 'authority' && inspectorRole !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Only authority officers or administrators can create inspections.');
    }
    const vehicleId = requireNonEmptyString(payload.vehicleId, 'vehicleId');
    const saccoId = requireNonEmptyString(payload.saccoId, 'saccoId');
    if (!['pass', 'fail', 'conditional'].includes(payload.result)) {
        throw new https_1.HttpsError('invalid-argument', 'result must be pass, fail, or conditional.');
    }
    if (payload.inspectionType && !['routine', 'spot_check', 'follow_up'].includes(payload.inspectionType)) {
        throw new https_1.HttpsError('invalid-argument', 'inspectionType is invalid.');
    }
    const [vehicleSnapshot, saccoSnapshot] = await Promise.all([
        db.collection('vehicles').doc(vehicleId).get(),
        db.collection('saccos').doc(saccoId).get(),
    ]);
    if (!vehicleSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'The selected vehicle does not exist.');
    }
    if (!saccoSnapshot.exists) {
        throw new https_1.HttpsError('not-found', 'The selected SACCO does not exist.');
    }
    const vehicle = vehicleSnapshot.data() || {};
    if (vehicle.saccoId !== saccoId) {
        throw new https_1.HttpsError('failed-precondition', 'The selected vehicle does not belong to the selected SACCO.');
    }
    const now = new Date();
    const createdAt = now.toISOString();
    const expiry = new Date(now.getTime() + CERTIFICATE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    const inspectionRef = db.collection('inspections').doc();
    const inspectionId = inspectionRef.id;
    const certificateNumber = generateCertificateNumber(inspectionId, now);
    const sacco = saccoSnapshot.data() || {};
    const inspection = {
        id: inspectionId,
        inspectionId,
        vehicleId,
        saccoId,
        saccoName: typeof sacco.name === 'string' ? sacco.name : undefined,
        inspectorId,
        inspectionType: payload.inspectionType || 'routine',
        result: payload.result,
        notes: typeof payload.notes === 'string' ? payload.notes.trim() : '',
        inspectionDate: typeof payload.inspectionDate === 'string' && payload.inspectionDate.trim()
            ? payload.inspectionDate.trim()
            : createdAt,
        certificateNumber,
        expiryDate: expiry.toISOString(),
        createdAt,
        updatedAt: createdAt,
    };
    const auditRef = db.collection('audit_logs').doc();
    await db.runTransaction(async (transaction) => {
        transaction.create(inspectionRef, inspection);
        transaction.create(auditRef, {
            id: auditRef.id,
            action: 'CREATE_INSPECTION',
            actorId: inspectorId,
            actorRole: inspectorRole,
            target: `Inspection ${inspectionId}`,
            timestamp: createdAt,
            details: {
                inspectionId,
                vehicleId,
                saccoId,
                result: payload.result,
                certificateNumber,
            },
        });
    });
    return {
        success: true,
        inspectionId,
        certificateNumber,
        expiryDate: expiry.toISOString(),
        createdAt,
    };
}
exports.createInspection = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'An authenticated authority session is required.');
    }
    const inspectorRole = resolveAuthorityRole(request.auth.token);
    return processCreateInspectionLogic((0, firestore_1.getFirestore)(), request.data, request.auth.uid, inspectorRole);
});
//# sourceMappingURL=createInspection.js.map