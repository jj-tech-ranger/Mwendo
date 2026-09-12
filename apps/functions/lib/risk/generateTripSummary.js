"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTripSummary = void 0;
exports.generateDeterministicSummary = generateDeterministicSummary;
exports.processGenerateTripSummaryLogic = processGenerateTripSummaryLogic;
const https_1 = require("firebase-functions/v2/https");
const genai_1 = require("@google/genai");
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
async function processGenerateTripSummaryLogic(payload, geminiApiKey) {
    const deterministic = generateDeterministicSummary(payload);
    const apiKey = geminiApiKey !== undefined ? (geminiApiKey || undefined) : process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            success: true,
            summary: deterministic.summary,
            riskTier: deterministic.riskTier,
            overspeedEventsCount: payload.overspeedEventsCount ?? 0,
            generatedBy: 'rule_engine',
        };
    }
    try {
        const ai = new genai_1.GoogleGenAI({
            apiKey,
            httpOptions: {
                headers: {
                    'User-Agent': 'aistudio-build',
                },
            },
        });
        const violationsText = payload.violations && payload.violations.length > 0
            ? payload.violations.map((v) => `${v.type} (${v.speed ? v.speed + ' km/h' : ''} ${v.location || ''})`).join(', ')
            : 'No safety violations logged';
        const prompt = `You are a Kenyan public transit road safety expert analyzing an ended trip for the Mwendo Salama platform.
Generate a concise, 1 to 2 sentence plain-language safety summary for the passenger.
Include specific numbers, locations, or violations if present.
Trip details:
- Route: ${payload.routeName || 'Unknown corridor'}
- SACCO: ${payload.saccoName || 'Independent operator'}
- Max Speed: ${payload.maxSpeedKmH} km/h (legal limit is 80 km/h)
- Average Speed: ${payload.avgSpeedKmH || 0} km/h
- Duration: ${Math.round((payload.durationSeconds || 0) / 60)} minutes
- Overspeed Events: ${payload.overspeedEventsCount || 0}
- Violations: ${violationsText}

Tone: objective, safety-focused, plain language (e.g. "This trip had 2 hard braking events and 1 sustained overspeed near Naivasha Road — moderate risk"). Keep it strictly under 40 words.`;
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
        });
        const aiText = response.text ? response.text.trim() : '';
        if (aiText && aiText.length > 10) {
            return {
                success: true,
                summary: aiText,
                riskTier: deterministic.riskTier,
                overspeedEventsCount: payload.overspeedEventsCount ?? 0,
                generatedBy: 'gemini',
            };
        }
        return {
            success: true,
            summary: deterministic.summary,
            riskTier: deterministic.riskTier,
            overspeedEventsCount: payload.overspeedEventsCount ?? 0,
            generatedBy: 'rule_engine',
        };
    }
    catch (err) {
        console.warn('Gemini API call failed, falling back to deterministic safety summary:', err);
        return {
            success: true,
            summary: deterministic.summary,
            riskTier: deterministic.riskTier,
            overspeedEventsCount: payload.overspeedEventsCount ?? 0,
            generatedBy: 'rule_engine',
        };
    }
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