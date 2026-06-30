/**
 * pricing.js — Shared business logic (Node + browser compatible)
 * Used by server.js for validation and by Jest tests.
 */

const PROPERTY_CONFIG = {
    cleaningFee:    75,
    serviceFeeRate: 0.14,
    taxRate:        0.115,
    minNights:      2,
    maxNights:      30,
    maxGuests:      4,
    minGuests:      1,
};

/**
 * Calculate full price breakdown for a stay.
 * @param {number} nights
 * @param {number} pricePerNight
 * @param {object} config  (optional override)
 * @returns {{ nights, base, clean, svc, taxes, total, pricePerNight } | null}
 */
function calcPrice(nights, pricePerNight, config = PROPERTY_CONFIG) {
    if (!nights || nights <= 0 || !pricePerNight || pricePerNight <= 0) return null;
    const base   = nights * pricePerNight;
    const clean  = config.cleaningFee;
    const svc    = Math.round(base * config.serviceFeeRate);
    const taxes  = Math.round((base + clean + svc) * config.taxRate);
    const total  = base + clean + svc + taxes;
    return { nights, base, clean, svc, taxes, total, pricePerNight };
}

/**
 * Number of nights between two ISO date strings.
 * @param {string} checkIn   e.g. '2025-07-01'
 * @param {string} checkOut  e.g. '2025-07-04'
 * @returns {number}
 */
function nightsBetween(checkIn, checkOut) {
    const s = new Date(checkIn  + 'T12:00:00');
    const e = new Date(checkOut + 'T12:00:00');
    return Math.round((e - s) / 86400000);
}

/**
 * Validate a check-in / check-out pair.
 * @returns {{ valid: boolean, nights?: number, error?: string }}
 */
function validateDates(checkIn, checkOut, config = PROPERTY_CONFIG) {
    if (!checkIn || !checkOut) return { valid: false, error: 'Missing dates' };

    const ciDate = new Date(checkIn  + 'T12:00:00');
    const coDate = new Date(checkOut + 'T12:00:00');

    if (isNaN(ciDate.getTime()) || isNaN(coDate.getTime())) {
        return { valid: false, error: 'Invalid date format' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (ciDate < today) return { valid: false, error: 'Check-in cannot be in the past' };
    if (coDate <= ciDate) return { valid: false, error: 'Check-out must be after check-in' };

    const nights = nightsBetween(checkIn, checkOut);
    if (nights < config.minNights) {
        return { valid: false, error: `Minimum stay is ${config.minNights} nights` };
    }
    if (nights > config.maxNights) {
        return { valid: false, error: `Maximum stay is ${config.maxNights} nights` };
    }

    return { valid: true, nights };
}

/**
 * Validate guest count.
 * @returns {{ valid: boolean, error?: string }}
 */
function validateGuests(guests, config = PROPERTY_CONFIG) {
    const n = parseInt(guests, 10);
    if (isNaN(n)) return { valid: false, error: 'Invalid guest count' };
    if (n < config.minGuests) return { valid: false, error: `Minimum ${config.minGuests} guest` };
    if (n > config.maxGuests) return { valid: false, error: `Maximum ${config.maxGuests} guests allowed` };
    return { valid: true };
}

/**
 * Check whether a date range overlaps any blocked dates.
 * Checks only interior dates (check-out day is not included).
 * @param {string}   checkIn
 * @param {string}   checkOut
 * @param {string[]} blockedDates  ISO strings
 * @returns {boolean}
 */
function rangeHasBlockedDate(checkIn, checkOut, blockedDates = []) {
    if (!blockedDates.length) return false;
    const blocked = new Set(blockedDates);
    const cur = new Date(checkIn + 'T12:00:00');
    const end = new Date(checkOut + 'T12:00:00');
    // include check-in day, exclude check-out day
    while (cur < end) {
        if (blocked.has(cur.toISOString().split('T')[0])) return true;
        cur.setDate(cur.getDate() + 1);
    }
    return false;
}

/**
 * Expand a confirmed reservation into its occupied date strings.
 * @param {string} checkIn
 * @param {string} checkOut
 * @returns {string[]}
 */
function expandReservationDates(checkIn, checkOut) {
    const dates = [];
    const cur = new Date(checkIn + 'T12:00:00');
    const end = new Date(checkOut + 'T12:00:00');
    while (cur < end) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

module.exports = {
    PROPERTY_CONFIG,
    calcPrice,
    nightsBetween,
    validateDates,
    validateGuests,
    rangeHasBlockedDate,
    expandReservationDates,
};
