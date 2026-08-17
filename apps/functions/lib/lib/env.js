"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_CHECK_ENFORCED = void 0;
/**
 * Environment configuration for Cloud Functions (Gen 2).
 *
 * SEC-002: App Check enforcement must default to true (fail-closed / enforced by default)
 * independent of runtime-inferred NODE_ENV, requiring an explicit opt-out via
 * APP_CHECK_ENFORCED='false' for local emulator testing without debug tokens.
 */
exports.APP_CHECK_ENFORCED = process.env.APP_CHECK_ENFORCED !== 'false';
//# sourceMappingURL=env.js.map