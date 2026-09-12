"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const env_1 = require("../lib/env");
exports.healthCheck = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    const role = String(request.auth?.token?.activeRole || request.auth?.token?.role || '');
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'An authenticated administrator session is required.');
    }
    if (role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Only system administrators can run infrastructure diagnostics.');
    }
    const db = (0, firestore_1.getFirestore)();
    const checks = [];
    const backendStart = Date.now();
    checks.push({
        service: 'backend',
        status: 'healthy',
        latencyMs: Date.now() - backendStart,
        details: 'Cloud Functions runtime accepted the authenticated diagnostic request.',
    });
    const firestoreStart = Date.now();
    try {
        const probeRef = db.collection('system_health_checks').doc('admin_probe');
        await probeRef.set({
            lastCheckedAt: new Date().toISOString(),
            source: 'admin-health-check',
        }, { merge: true });
        checks.push({
            service: 'firestore',
            status: 'healthy',
            latencyMs: Date.now() - firestoreStart,
            details: 'Admin SDK successfully wrote the backend health probe.',
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Firestore error.';
        checks.push({
            service: 'firestore',
            status: 'error',
            latencyMs: Date.now() - firestoreStart,
            details: `Admin SDK Firestore probe failed: ${message}`,
        });
    }
    return {
        checkedAt: new Date().toISOString(),
        checks,
    };
});
//# sourceMappingURL=healthCheck.js.map