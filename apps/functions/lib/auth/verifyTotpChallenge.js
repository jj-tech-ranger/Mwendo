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
/**
 * Decode standard Base32 string into a Buffer.
 */
function base32Decode(base32Str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let index = 0;
    const clean = base32Str.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    const output = new Uint8Array(Math.floor((clean.length * 5) / 8));
    for (let i = 0; i < clean.length; i++) {
        const char = clean[i] ?? '';
        const val = alphabet.indexOf(char);
        if (val === -1) {
            throw new Error(`Invalid base32 character: ${char}`);
        }
        value = (value << 5) | val;
        bits += 5;
        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return Buffer.from(output);
}
/**
 * Generate standard RFC 6238 TOTP token for a given secret and timestamp.
 */
function generateTotpToken(secretBase32, timestampMs = Date.now(), stepSec = 30, digits = 6) {
    const key = base32Decode(secretBase32);
    const epoch = Math.floor(timestampMs / 1000);
    const timeStep = Math.floor(epoch / stepSec);
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(timeStep));
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const lastByte = hmac[hmac.length - 1] ?? 0;
    const offset = lastByte & 0x0f;
    const b0 = hmac[offset] ?? 0;
    const b1 = hmac[offset + 1] ?? 0;
    const b2 = hmac[offset + 2] ?? 0;
    const b3 = hmac[offset + 3] ?? 0;
    const code = ((b0 & 0x7f) << 24) |
        ((b1 & 0xff) << 16) |
        ((b2 & 0xff) << 8) |
        (b3 & 0xff);
    const mod = 10 ** digits;
    return (code % mod).toString().padStart(digits, '0');
}
/**
 * Verify submitted TOTP token against secret with allowable window steps.
 */
function verifyTotpToken(secretBase32, token, windowSteps = 1, timestampMs = Date.now()) {
    const cleanToken = token.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanToken)) {
        return false;
    }
    const stepSec = 30;
    for (let w = -windowSteps; w <= windowSteps; w++) {
        const checkTime = timestampMs + w * stepSec * 1000;
        if (generateTotpToken(secretBase32, checkTime, stepSec, 6) === cleanToken) {
            return true;
        }
    }
    return false;
}
/**
 * Callable Function: verifyTotpChallenge (§AUTH-003)
 * Authoritatively verifies a user's TOTP challenge code against their enrolled TOTP secret.
 * Only marks isMfaVerified: true in Firestore if cryptographic verification succeeds.
 */
exports.verifyTotpChallenge = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    const callerUid = request.auth.uid;
    const rawCode = request.data?.code;
    if (!rawCode || typeof rawCode !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'The code string parameter must be provided.');
    }
    const cleanCode = rawCode.trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
        throw new https_1.HttpsError('invalid-argument', 'Verification code must be exactly 6 digits.');
    }
    const db = (0, firestore_1.getFirestore)();
    const authAdmin = (0, auth_1.getAuth)();
    // 1. Fetch user record from Firestore
    const userRef = db.collection('users').doc(callerUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('not-found', 'User record not found in Firestore.');
    }
    const userData = userSnap.data() || {};
    const secretKey = userData.totpSecret || userData.mfaSecret;
    if (!secretKey) {
        // Check if enrolled in Firebase Auth
        try {
            const authUser = await authAdmin.getUser(callerUid);
            const factors = authUser.multiFactor?.enrolledFactors || [];
            if (factors.length === 0) {
                throw new https_1.HttpsError('failed-precondition', 'User has no enrolled MFA factors.');
            }
        }
        catch {
            throw new https_1.HttpsError('failed-precondition', 'No enrolled TOTP MFA secret found for this account.');
        }
        throw new https_1.HttpsError('failed-precondition', 'No enrolled TOTP MFA secret found on user profile.');
    }
    // 2. Cryptographic verification of 6-digit TOTP against stored secret
    const isValid = verifyTotpToken(secretKey, cleanCode, 1, Date.now());
    if (!isValid) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid 6-digit TOTP verification code.');
    }
    // 3. Mark user as MFA verified in Firestore (Server-authoritative write)
    await userRef.set({
        isMfaVerified: true,
        isMfaEnrolled: true,
        updatedAt: new Date().toISOString(),
    }, { merge: true });
    // 4. Record audit log
    await db.collection('audit_logs').add({
        action: 'MFA_CHALLENGE_VERIFIED',
        actorUid: callerUid,
        actorName: userData.displayName || request.auth.token?.name || 'User',
        actorRole: userData.activeRole || userData.role || 'user',
        timestamp: new Date().toISOString(),
    });
    return { success: true, verified: true };
});
//# sourceMappingURL=verifyTotpChallenge.js.map