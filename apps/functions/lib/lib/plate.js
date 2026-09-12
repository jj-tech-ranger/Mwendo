"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePlate = normalizePlate;
exports.isValidPlateFormat = isValidPlateFormat;
/**
 * Normalizes a Kenyan motor vehicle registration number (plate identifier).
 * Strips ALL internal and external whitespace and converts characters to uppercase.
 * Ensures consistent vehicle document key and reference resolution across client and function code.
 *
 * @example
 * normalizePlate('KAA 123B') // 'KAA123B'
 * normalizePlate(' kaa  123b ') // 'KAA123B'
 * normalizePlate('KAA123B') // 'KAA123B'
 */
function normalizePlate(plate) {
    if (!plate)
        return '';
    return plate.replace(/\s+/g, '').toUpperCase();
}
/**
 * Validates whether a given string is a plausible Kenyan motor vehicle plate number.
 * Accepts formats with or without internal whitespace (e.g. 'KAA 123B', 'KAA123B').
 */
function isValidPlateFormat(plate) {
    if (!plate)
        return false;
    const normalized = normalizePlate(plate);
    return /^K[A-Z]{2}[0-9]{3}[A-Z]$/.test(normalized);
}
//# sourceMappingURL=plate.js.map