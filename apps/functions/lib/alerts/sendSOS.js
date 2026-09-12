"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSOS = exports.DefaultMessagingProvider = exports.DefaultSmsProvider = void 0;
exports.writeToDLQ = writeToDLQ;
exports.processSendSosLogic = processSendSosLogic;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const rateLimit_1 = require("../lib/rateLimit");
function isEmulator() { return process.env.FUNCTIONS_EMULATOR === 'true' || !!process.env.FIREBASE_EMULATOR_HUB; }
function validLocation(lat, lng) { return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -5.5 && lat <= 6.0 && lng >= 33.0 && lng <= 43.5; }
function validSpeed(speed) { return Number.isFinite(speed) && speed >= 0 && speed <= 180; }
class DefaultSmsProvider {
    accountSid = process.env.TWILIO_ACCOUNT_SID;
    authToken = process.env.TWILIO_AUTH_TOKEN;
    fromNumber = process.env.TWILIO_FROM_NUMBER;
    async sendSms(to, message) {
        if (!this.accountSid || !this.authToken || !this.fromNumber) {
            if (isEmulator())
                return { messageId: `emulator_sms_${Date.now()}`, success: true };
            throw new Error('SMS provider is not configured in production.');
        }
        const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
        const body = new URLSearchParams({ To: to, From: this.fromNumber, Body: message });
        const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        });
        if (!response.ok)
            throw new Error(`Twilio API HTTP ${response.status}`);
        const data = await response.json();
        return { messageId: data.sid || `sms_${Date.now()}`, success: true };
    }
}
exports.DefaultSmsProvider = DefaultSmsProvider;
class DefaultMessagingProvider {
    async sendToTopic(topic, payload) {
        try {
            return await (0, messaging_1.getMessaging)().send({ topic, notification: payload.notification, data: payload.data || {} });
        }
        catch (err) {
            if (isEmulator())
                return { messageId: `emulator_fcm_${Date.now()}` };
            throw err;
        }
    }
}
exports.DefaultMessagingProvider = DefaultMessagingProvider;
async function writeToDLQ(db, entry) {
    try {
        await db.collection('dlq_notifications').doc(entry.id).set({
            id: entry.id, topic: entry.topic, type: entry.type, alertId: entry.alertId,
            userId: entry.userId || 'unknown', targetRecipient: entry.targetRecipient || 'unknown',
            payload: entry.payload || null,
            errorMessage: entry.error instanceof Error ? entry.error.message : String(entry.error),
            failedAt: new Date().toISOString(), status: 'failed_dead_letter', retryAttempts: 0,
        });
    }
    catch (err) {
        console.error('[DLQ] Failed to record notification failure:', err);
    }
}
async function processSendSosLogic(db, messagingProvider, smsProvider, payload) {
    const userId = payload.userId || 'anonymous';
    if (!userId || userId === 'anonymous')
        throw new https_1.HttpsError('unauthenticated', 'Authenticated passenger required.');
    const rawLat = payload.location?.lat ?? payload.latitude;
    const rawLng = payload.location?.lng ?? payload.longitude;
    if (typeof rawLat !== 'number' || typeof rawLng !== 'number' || !validLocation(rawLat, rawLng))
        throw new https_1.HttpsError('invalid-argument', 'A valid location is required.');
    const speedKmH = payload.speedKmH ?? 0;
    if (!validSpeed(speedKmH))
        throw new https_1.HttpsError('invalid-argument', 'Speed must be between 0 and 180 km/h.');
    if (payload.message && payload.message.length > 1000)
        throw new https_1.HttpsError('invalid-argument', 'Message is too long.');
    const alertId = payload.alertId && /^sos_[A-Za-z0-9_-]{1,100}$/.test(payload.alertId) ? payload.alertId : `sos_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const requestRef = db.collection('sos_requests').doc(alertId);
    const existing = await requestRef.get();
    if (existing.exists) {
        const existingData = existing.data() || {};
        if (existingData.status === 'completed' && existingData.result)
            return existingData.result;
        if (existingData.status === 'processing')
            throw new https_1.HttpsError('aborted', 'This SOS request is already being processed.');
    }
    await requestRef.create({ alertId, userId, status: 'processing', createdAt: new Date().toISOString() }).catch(async (err) => {
        if (existing.exists)
            throw new https_1.HttpsError('aborted', 'This SOS request is already being processed.');
        throw err;
    });
    try {
        await (0, rateLimit_1.enforceRateLimit)(db, userId, 'sos');
        const userSnap = await db.collection('users').doc(userId).get();
        const userData = userSnap.data() || {};
        const userDisplayName = typeof userData.displayName === 'string' ? userData.displayName.slice(0, 120) : 'Passenger';
        const emergencyContacts = Array.isArray(userData.emergencyContacts) ? userData.emergencyContacts.filter((c) => !!c && typeof c.phone === 'string' && c.phone.length <= 30).slice(0, 5) : [];
        // Never trust client-supplied vehicle/SACCO identity for alert routing. Resolve it
        // from an owned active trip, or from the referenced vehicle record when available.
        let vehicleRegNumber = '';
        let saccoId = '';
        if (payload.tripId) {
            const tripSnap = await db.collection('trips').doc(payload.tripId).get();
            if (!tripSnap.exists || tripSnap.data()?.userId !== userId) {
                throw new https_1.HttpsError('permission-denied', 'The referenced trip does not belong to the caller.');
            }
            const trip = tripSnap.data() || {};
            vehicleRegNumber = typeof trip.vehicleRegNumber === 'string' ? trip.vehicleRegNumber : '';
            saccoId = typeof trip.saccoId === 'string' ? trip.saccoId : '';
        }
        else if (payload.vehicleRegNumber) {
            const vehicleRefId = payload.vehicleRegNumber.replace(/\s+/g, '_');
            const vehicleSnap = await db.collection('vehicles').doc(vehicleRefId).get();
            if (!vehicleSnap.exists)
                throw new https_1.HttpsError('not-found', 'The referenced vehicle was not found.');
            const vehicle = vehicleSnap.data() || {};
            vehicleRegNumber = typeof vehicle.registrationNumber === 'string' ? vehicle.registrationNumber : payload.vehicleRegNumber;
            saccoId = typeof vehicle.saccoId === 'string' ? vehicle.saccoId : '';
        }
        // A client-provided SACCO id is deliberately ignored. It must be derived from
        // trusted trip/vehicle data so a caller cannot broadcast an SOS to another SACCO.
        const effectiveSaccoId = saccoId || 'unassigned';
        const effectiveVehicleReg = vehicleRegNumber || 'Vehicle In Transit';
        const timestamp = payload.timestamp || new Date().toISOString();
        const mapsLink = `https://www.google.com/maps?q=${rawLat},${rawLng}`;
        const smsBody = `MWENDO SALAMA EMERGENCY SOS: ${userDisplayName} has triggered an urgent safety alert on PSV ${effectiveVehicleReg}. Map: ${mapsLink}. Please check on them immediately.`;
        const contactsSummary = [];
        const fcmSummary = [];
        let successfulSmsCount = 0;
        let successfulFcmCount = 0;
        let dlqCount = 0;
        for (const contact of emergencyContacts) {
            try {
                const result = await smsProvider.sendSms(contact.phone, smsBody);
                if (!result.success)
                    throw new Error('SMS provider reported failure.');
                successfulSmsCount++;
                contactsSummary.push({ name: contact.name || 'Emergency contact', relationship: contact.relationship || '', status: 'dispatched' });
            }
            catch (err) {
                dlqCount++;
                contactsSummary.push({ name: contact.name || 'Emergency contact', relationship: contact.relationship || '', status: 'failed' });
                await writeToDLQ(db, { id: `dlq_sms_${alertId}_${successfulSmsCount}_${Date.now()}`, topic: 'safety-alerts', type: 'sms_emergency_contact', alertId, userId, targetRecipient: `${contact.name || 'Emergency contact'} (${contact.phone})`, payload: { message: smsBody }, error: err });
            }
        }
        const fcmPayload = { notification: { title: `EMERGENCY SOS: ${effectiveVehicleReg}`, body: `${userDisplayName} triggered SOS. Location ${rawLat.toFixed(4)}, ${rawLng.toFixed(4)}.` }, data: { alertId, tripId: payload.tripId || '', vehicleRegNumber: effectiveVehicleReg, saccoId: effectiveSaccoId, latitude: String(rawLat), longitude: String(rawLng), type: 'sos', severity: 'critical', timestamp } };
        const topics = effectiveSaccoId !== 'unassigned' ? [`sacco_${effectiveSaccoId.replace(/\s+/g, '_')}`, 'authority_alerts'] : ['authority_alerts'];
        for (const topic of topics) {
            try {
                await messagingProvider.sendToTopic(topic, fcmPayload);
                successfulFcmCount++;
                fcmSummary.push({ target: topic, status: 'dispatched' });
            }
            catch (err) {
                dlqCount++;
                fcmSummary.push({ target: topic, status: 'failed' });
                await writeToDLQ(db, { id: `dlq_fcm_${alertId}_${Date.now()}`, topic: 'safety-alerts', type: 'fcm_push_notification', alertId, userId, targetRecipient: topic, payload: fcmPayload, error: err });
            }
        }
        const safetyAlertData = {
            id: alertId, tripId: payload.tripId || null, userId, vehicleRegNumber: effectiveVehicleReg, saccoId: effectiveSaccoId,
            type: 'sos', severity: 'critical', message: payload.message || `Emergency SOS triggered by ${userDisplayName}`,
            latitude: rawLat, longitude: rawLng, speedKmH, timestamp, status: 'active',
            acknowledgedBySacco: false, acknowledgedByAuthority: false,
            smsDispatchedCount: successfulSmsCount, fcmDispatchedCount: successfulFcmCount,
            emergencyContactsCount: emergencyContacts.length, updatedAt: new Date().toISOString(),
        };
        await db.collection('safety_alerts').doc(alertId).create(safetyAlertData);
        const result = { success: true, alertId, userId, saccoId: effectiveSaccoId, contactsNotifiedCount: successfulSmsCount, fcmDispatchedCount: successfulFcmCount, dlqCount, contactsSummary, fcmSummary };
        await db.collection('audit_logs').doc(`audit_${alertId}`).set({ id: `audit_${alertId}`, action: 'EMERGENCY_SOS_DISPATCHED', actorUid: userId, actorName: userDisplayName, actorRole: 'passenger', saccoId: effectiveSaccoId, target: `Alert ${alertId} (${effectiveVehicleReg})`, timestamp: new Date().toISOString(), details: { alertId, emergencyContactsConfigured: emergencyContacts.length, smsDispatchedCount: successfulSmsCount, fcmDispatchedCount: successfulFcmCount, dlqCount } });
        await requestRef.update({ status: 'completed', result, completedAt: new Date().toISOString() });
        return result;
    }
    catch (err) {
        await requestRef.set({ status: 'failed', failedAt: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) }, { merge: true });
        throw err;
    }
}
exports.sendSOS = (0, https_1.onCall)({ enforceAppCheck: true }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Caller must be authenticated to invoke sendSOS.');
    const payload = { ...request.data, userId: request.auth.uid };
    try {
        return await processSendSosLogic((0, firestore_1.getFirestore)(), new DefaultMessagingProvider(), new DefaultSmsProvider(), payload);
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error('[sendSOS] Execution failed:', err);
        throw new https_1.HttpsError('internal', 'Emergency SOS dispatch failed.');
    }
});
//# sourceMappingURL=sendSOS.js.map