"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyTotpChallenge = void 0;
exports.base32Decode = base32Decode;
exports.generateTotpToken = generateTotpToken;
exports.verifyTotpToken = verifyTotpToken;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const auth_1 = require("firebase-admin/auth");
const crypto = __importStar(require("crypto"));
function base32Decode(base32Str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let index = 0;
    const clean = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    const output = new Uint8Array(Math.floor((clean.length * 5) / 8));
    for (let i = 0; i < clean.length; i++) {
        const val = alphabet.indexOf(clean[i] ?? '');
        if (val === -1)
            throw new Error('Invalid base32 character.');
        value = (value << 5) | val;
        bits += 5;
        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return Buffer.from(output);
}
function generateTotpToken(secretBase32, timestampMs = Date.now(), stepSec = 30, digits = 6) {
    const key = base32Decode(secretBase32);
    const timeStep = Math.floor(timestampMs / 1000 / stepSec);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(timeStep));
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
    const code = (((hmac[offset] ?? 0) & 0x7f) << 24) | ((hmac[offset + 1] ?? 0) << 16) | ((hmac[offset + 2] ?? 0) << 8) | (hmac[offset + 3] ?? 0);
    return (code % 10 ** digits).toString().padStart(digits, '0');
}
function verifyTotpToken(secretBase32, token, windowSteps = 1, timestampMs = Date.now()) {
    const cleanToken = token.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanToken))
        return false;
    for (let w = -windowSteps; w <= windowSteps; w++) {
        if (generateTotpToken(secretBase32, timestampMs + w * 30_000) === cleanToken)
            return true;
    }
    return false;
}
exports.verifyTotpChallenge = (0, https_1.onCall)({ enforceAppCheck: true }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    const callerUid = request.auth.uid;
    const rawCode = request.data?.code;
    if (typeof rawCode !== 'string')
        throw new https_1.HttpsError('invalid-argument', 'The code string parameter must be provided.');
    const cleanCode = rawCode.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode))
        throw new https_1.HttpsError('invalid-argument', 'Verification code must be exactly 6 digits.');
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    const userRef = db.collection('users').doc(callerUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists)
        throw new https_1.HttpsError('not-found', 'User record not found in Firestore.');
    const userData = userSnap.data() || {};
    const secretKey = typeof userData.totpSecret === 'string' ? userData.totpSecret : typeof userData.mfaSecret === 'string' ? userData.mfaSecret : '';
    if (!secretKey) {
        const authUser = await authAdmin.getUser(callerUid);
        if (!authUser.multiFactor?.enrolledFactors?.length)
            throw new https_1.HttpsError('failed-precondition', 'User has no enrolled MFA factors.');
        throw new https_1.HttpsError('failed-precondition', 'No server-side TOTP secret is configured for this account.');
    }
    if (!verifyTotpToken(secretKey, cleanCode))
        throw new https_1.HttpsError('invalid-argument', 'Invalid 6-digit TOTP verification code.');
    await userRef.set({ isMfaVerified: true, isMfaEnrolled: true, updatedAt: new Date().toISOString() }, { merge: true });
    await db.collection('audit_logs').add({
        action: 'MFA_CHALLENGE_VERIFIED', actorUid: callerUid,
        actorName: userData.displayName || request.auth.token?.name || 'User',
        actorRole: request.auth.token?.activeRole || 'user', timestamp: new Date().toISOString(),
    });
    return { success: true, verified: true };
});
//# sourceMappingURL=verifyTotpChallenge.js.map