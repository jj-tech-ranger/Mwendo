"use strict";
/**
 * Core Algorithmic Engine for Mwendo Salama Functions
 * Implements GPS smoothing, confidence scoring, vehicle risk calculation,
 * reporter trust engine, and violation detection rules.
 * Functions-local package copy for isolated Firebase Functions deployment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectOverspeedViolations = exports.calculateSaccoSafetyScore = exports.calculateVehicleRiskScore = exports.getTrustBadgeLevel = exports.calculateReporterTrustScore = exports.ConfidenceScorer = exports.SpeedSmoother = void 0;
/**
 * 1. SpeedSmoother (GPS filtering & EMA speed smoothing)
 * Discards samples with accuracy > 30m.
 * EMA formula: smoothed = alpha * raw + (1 - alpha) * prev, where alpha = 0.35.
 */
class SpeedSmoother {
    alpha;
    maxAllowedAccuracy;
    currentSmoothedSpeed = null;
    constructor(alpha = 0.35, maxAllowedAccuracy = 30) {
        this.alpha = alpha;
        this.maxAllowedAccuracy = maxAllowedAccuracy;
    }
    reset() {
        this.currentSmoothedSpeed = null;
    }
    processSample(sample) {
        if (sample.accuracy > this.maxAllowedAccuracy || sample.accuracy <= 0 || isNaN(sample.accuracy)) {
            return {
                isValid: false,
                smoothedSpeedKmH: this.currentSmoothedSpeed ?? 0,
            };
        }
        if (!Number.isFinite(sample.speedKmH)) {
            return {
                isValid: false,
                smoothedSpeedKmH: this.currentSmoothedSpeed ?? 0,
            };
        }
        const rawSpeed = Math.max(0, sample.speedKmH);
        if (this.currentSmoothedSpeed === null) {
            this.currentSmoothedSpeed = rawSpeed;
        }
        else {
            this.currentSmoothedSpeed =
                this.alpha * rawSpeed + (1 - this.alpha) * this.currentSmoothedSpeed;
        }
        return {
            isValid: true,
            smoothedSpeedKmH: Math.round(this.currentSmoothedSpeed * 100) / 100,
        };
    }
    processBatch(samples) {
        this.reset();
        const result = [];
        for (const sample of samples) {
            const res = this.processSample(sample);
            if (res.isValid) {
                result.push(res.smoothedSpeedKmH);
            }
        }
        return result;
    }
}
exports.SpeedSmoother = SpeedSmoother;
/**
 * 2. Confidence Scoring
 */
exports.ConfidenceScorer = {
    /**
     * Trip Confidence Score:
     * Trip Confidence = 0.4 * AccuracyScore + 0.3 * ContinuityScore + 0.3 * DensityScore
     * Returns a value between 0.0 and 1.0.
     */
    calculateTripConfidence(samples, expectedIntervalSec = 5, tripDurationSec = 300) {
        if (!samples || samples.length === 0)
            return 0;
        // Accuracy Score: fraction of valid GPS points with accuracy <= 30m, weighted by accuracy value
        let totalAccuracyWeight = 0;
        let validCount = 0;
        for (const s of samples) {
            if (s.accuracy > 0 && s.accuracy <= 30) {
                validCount++;
                totalAccuracyWeight += (30 - s.accuracy) / 30;
            }
        }
        const accuracyScore = samples.length > 0 ? totalAccuracyWeight / samples.length : 0;
        // Continuity Score: fraction of consecutive time gaps that are <= 2 * expectedIntervalSec
        let continuityCount = 0;
        const totalGaps = samples.length - 1;
        if (totalGaps > 0) {
            for (let i = 1; i < samples.length; i++) {
                const prev = samples[i - 1];
                const curr = samples[i];
                if (!prev || !curr)
                    continue;
                const t1 = new Date(prev.timestamp).getTime();
                const t2 = new Date(curr.timestamp).getTime();
                const gapSec = (t2 - t1) / 1000;
                if (gapSec > 0 && gapSec <= expectedIntervalSec * 2.5) {
                    continuityCount++;
                }
            }
        }
        const continuityScore = totalGaps > 0 ? continuityCount / totalGaps : 1.0;
        // Density Score: actual sample count vs expected sample count
        const expectedPoints = Math.max(1, Math.floor(tripDurationSec / expectedIntervalSec));
        const densityScore = Math.min(1.0, samples.length / expectedPoints);
        const totalConfidence = 0.4 * accuracyScore + 0.3 * continuityScore + 0.3 * densityScore;
        return Math.round(Math.min(1.0, Math.max(0.0, totalConfidence)) * 1000) / 1000;
    },
    /**
     * Violation Confidence Score:
     * Weighted by duration, accuracy (<= 30m gate), and corroboration count.
     */
    calculateViolationConfidence(durationSec, gpsAccuracyMeters, corroborationsCount = 0) {
        // <= 30m accuracy gate (weighted, not hard <10m cutoff)
        if (gpsAccuracyMeters > 30 || gpsAccuracyMeters <= 0) {
            return 0.0;
        }
        const accuracyFactor = (30 - gpsAccuracyMeters) / 30; // 1.0 at 0m, 0.0 at 30m
        const durationFactor = Math.min(1.0, durationSec / 4.0); // 1.0 at >= 4 seconds
        const corroborationFactor = Math.min(1.0, corroborationsCount * 0.5);
        const confidence = 0.4 * durationFactor + 0.4 * accuracyFactor + 0.2 * corroborationFactor;
        return Math.round(Math.min(1.0, Math.max(0.0, confidence)) * 1000) / 1000;
    },
    /**
     * Hazard Confidence Score:
     * Corroborations + Reporter Trust + Evidence photo
     */
    calculateHazardConfidence(corroborationsCount, reporterTrustScore, hasEvidencePhoto) {
        const corrFactor = Math.min(1.0, corroborationsCount / 3.0);
        const trustFactor = Math.min(1.0, Math.max(0.0, reporterTrustScore));
        const photoFactor = hasEvidencePhoto ? 1.0 : 0.0;
        const confidence = 0.4 * corrFactor + 0.4 * trustFactor + 0.2 * photoFactor;
        return Math.round(Math.min(1.0, Math.max(0.0, confidence)) * 1000) / 1000;
    },
};
/**
 * 6. Reporter Trust Engine
 * Formula: ReporterTrustScore = min(1.0, max(0.0, 0.5 + (confirmedCount * 0.1) - (falseCount * 0.2) + min(0.2, accountAgeDays * 0.005)))
 */
const calculateReporterTrustScore = (confirmedReportsCount, falseReportsCount, accountAgeDays) => {
    const base = 0.5;
    const confirmedBonus = confirmedReportsCount * 0.1;
    const falsePenalty = falseReportsCount * 0.2;
    const ageBonus = Math.min(0.2, accountAgeDays * 0.005);
    const total = base + confirmedBonus - falsePenalty + ageBonus;
    return Math.round(Math.min(1.0, Math.max(0.0, total)) * 100) / 100;
};
exports.calculateReporterTrustScore = calculateReporterTrustScore;
const getTrustBadgeLevel = (trustScore) => {
    if (trustScore >= 0.9)
        return 'verified_guardian';
    if (trustScore >= 0.75)
        return 'gold';
    if (trustScore >= 0.6)
        return 'silver';
    return 'bronze';
};
exports.getTrustBadgeLevel = getTrustBadgeLevel;
const calculateVehicleRiskScore = (events, totalTripCount, currentTimeMs = Date.now()) => {
    const lambda = Math.LN2 / 30; // 30-day decay constant
    let totalPenalties = 0;
    for (const ev of events) {
        const eventTimeMs = new Date(ev.timestamp).getTime();
        if (!Number.isFinite(eventTimeMs)) {
            continue;
        }
        const ageDays = Math.max(0, (currentTimeMs - eventTimeMs) / 86400000);
        const decayFactor = Math.min(1.0, Math.exp(-lambda * ageDays));
        let basePenalty = 5;
        switch (ev.severity) {
            case 'low':
                basePenalty = 3;
                break;
            case 'medium':
                basePenalty = 8;
                break;
            case 'high':
                basePenalty = 18;
                break;
            case 'critical':
                basePenalty = 30;
                break;
        }
        const confidenceWeight = ev.confidenceScore ?? 1.0;
        totalPenalties += basePenalty * decayFactor * confidenceWeight;
    }
    // Base raw risk starting from perfect 100
    const rawScore = Math.max(0, 100 - totalPenalties);
    // Sub-100-trip regularization floor
    // Default unregularized baseline = 85
    const BASELINE_SCORE = 85;
    const tripFactor = Math.min(1.0, totalTripCount / 100);
    const finalScore = Math.round(rawScore * tripFactor + BASELINE_SCORE * (1 - tripFactor));
    const safeFinalScore = Number.isFinite(finalScore) ? finalScore : BASELINE_SCORE;
    let riskTier = 'low';
    if (safeFinalScore < 45)
        riskTier = 'critical';
    else if (safeFinalScore < 65)
        riskTier = 'high';
    else if (safeFinalScore < 80)
        riskTier = 'medium';
    return { riskScore: safeFinalScore, riskTier };
};
exports.calculateVehicleRiskScore = calculateVehicleRiskScore;
const calculateSaccoSafetyScore = (fleetVehicleScores, unresolvedComplaintsCount = 0) => {
    if (!fleetVehicleScores || fleetVehicleScores.length === 0)
        return 85;
    const avgFleetScore = fleetVehicleScores.reduce((a, b) => a + b, 0) / fleetVehicleScores.length;
    const complaintDeduction = Math.min(25, unresolvedComplaintsCount * 2);
    const finalScore = Math.round(Math.max(0, Math.min(100, avgFleetScore - complaintDeduction)));
    return finalScore;
};
exports.calculateSaccoSafetyScore = calculateSaccoSafetyScore;
const detectOverspeedViolations = (samples, speedLimitKmH = 80) => {
    const violations = [];
    if (!samples || samples.length === 0)
        return violations;
    const smoother = new SpeedSmoother(0.35, 30);
    let consecutiveOverspeedStartTime = null;
    let currentMaxSpeed = 0;
    let cooldownUntilMs = 0;
    for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (!s)
            continue;
        const sampleTimeMs = new Date(s.timestamp).getTime();
        const { isValid, smoothedSpeedKmH } = smoother.processSample(s);
        if (!isValid)
            continue;
        if (sampleTimeMs < cooldownUntilMs) {
            // In cooldown window
            consecutiveOverspeedStartTime = null;
            currentMaxSpeed = 0;
            continue;
        }
        if (smoothedSpeedKmH > speedLimitKmH) {
            if (consecutiveOverspeedStartTime === null) {
                consecutiveOverspeedStartTime = sampleTimeMs;
                currentMaxSpeed = smoothedSpeedKmH;
            }
            else {
                currentMaxSpeed = Math.max(currentMaxSpeed, smoothedSpeedKmH);
                const durationSec = (sampleTimeMs - consecutiveOverspeedStartTime) / 1000;
                if (durationSec >= 4.0) {
                    // Trigger violation!
                    violations.push({
                        startTime: new Date(consecutiveOverspeedStartTime).toISOString(),
                        endTime: new Date(sampleTimeMs).toISOString(),
                        durationSec: Math.round(durationSec * 10) / 10,
                        maxSpeedKmH: currentMaxSpeed,
                        speedLimitKmH,
                    });
                    // Enter 20-second cooldown window
                    cooldownUntilMs = sampleTimeMs + 20000;
                    consecutiveOverspeedStartTime = null;
                    currentMaxSpeed = 0;
                }
            }
        }
        else {
            consecutiveOverspeedStartTime = null;
            currentMaxSpeed = 0;
        }
    }
    return violations;
};
exports.detectOverspeedViolations = detectOverspeedViolations;
//# sourceMappingURL=engine.js.map