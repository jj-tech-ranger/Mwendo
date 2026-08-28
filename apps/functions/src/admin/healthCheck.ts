import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { APP_CHECK_ENFORCED } from '../lib/env';

interface HealthCheckResult {
  service: 'backend' | 'firestore';
  status: 'healthy' | 'error';
  latencyMs: number;
  details: string;
}

export const healthCheck = onCall(
  { enforceAppCheck: APP_CHECK_ENFORCED },
  async (request) => {
    const role = String(request.auth?.token?.activeRole || request.auth?.token?.role || '');

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'An authenticated administrator session is required.');
    }

    if (role !== 'admin') {
      throw new HttpsError('permission-denied', 'Only system administrators can run infrastructure diagnostics.');
    }

    const db = getFirestore();
    const checks: HealthCheckResult[] = [];

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
      await probeRef.set(
        {
          lastCheckedAt: new Date().toISOString(),
          source: 'admin-health-check',
        },
        { merge: true }
      );

      checks.push({
        service: 'firestore',
        status: 'healthy',
        latencyMs: Date.now() - firestoreStart,
        details: 'Admin SDK successfully wrote the backend health probe.',
      });
    } catch (error: unknown) {
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
  }
);
