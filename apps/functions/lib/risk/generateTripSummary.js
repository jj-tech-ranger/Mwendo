"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTripSummary = void 0;
exports.generateDeterministicSummary = generateDeterministicSummary;
exports.processGenerateTripSummaryLogic = processGenerateTripSummaryLogic;
const https_1 = require("firebase-functions/v2/https");
const env_1 = require("../lib/env");
function generateDeterministicSummary(payload) {
    const overspeed = payload.overspeedEventsCount ?? (payload.violations ? payload.violations.length : 0);
    const maxSpeed = payload.maxSpeedKmH || 0;
    const route = payload.routeName || 'this corridor';
    if (maxSpeed > 100 || overspeed >= 3) {
        return {
            summary: `This trip recorded ${overspeed} severe overspeed violation${overspeed === 1 ? '' : 's'} reaching a peak speed of ${maxSpeed} km/h along ${route} — high safety risk.`,
            riskTier: 'high',
        };
    }
    if (maxSpeed > 80 || overspeed > 0) {
        const violationSummary = payload.violations && payload.violations.length > 0
            ? payload.violations.map((v) => v.details || v.type).slice(0, 2).join(' and ')
            : `${overspeed} sustained overspeed event${overspeed === 1 ? '' : 's'}`;
        return {
            summary: `This trip recorded ${violationSummary} along ${route} — moderate risk. Speeds peaked at ${maxSpeed} km/h.`,
            riskTier: 'moderate',
        };
    }
    return {
        summary: `This trip maintained compliant driving speeds within the legal 80 km/h threshold along ${route} with 0 recorded violations — low risk.`,
        riskTier: 'low',
    };
}
async function processGenerateTripSummaryLogic(payload, _geminiApiKey) {
    const deterministic = generateDeterministicSummary(payload);
    return {
        success: true,
        summary: deterministic.summary,
        riskTier: deterministic.riskTier,
        overspeedEventsCount: payload.overspeedEventsCount ?? 0,
        generatedBy: 'rule_engine',
    };
}
exports.generateTripSummary = (0, https_1.onCall)({ enforceAppCheck: env_1.APP_CHECK_ENFORCED }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to generate trip safety summary.');
    }
    const payload = request.data;
    if (!payload || typeof payload.maxSpeedKmH !== 'number') {
        throw new https_1.HttpsError('invalid-argument', 'Trip speed profile with maxSpeedKmH is required.');
    }
    return processGenerateTripSummaryLogic(payload);
});
//# sourceMappingURL=generateTripSummary.js.map