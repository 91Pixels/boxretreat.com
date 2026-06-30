/**
 * pricing.test.js — Unit tests for price calculation logic
 */

const {
    calcPrice,
    nightsBetween,
    validateDates,
    validateGuests,
    PROPERTY_CONFIG,
} = require('../lib/pricing');

/* ================================================================
   nightsBetween
================================================================ */
describe('nightsBetween', () => {
    test('calculates 2 nights correctly', () => {
        expect(nightsBetween('2025-07-01', '2025-07-03')).toBe(2);
    });

    test('calculates 7 nights correctly', () => {
        expect(nightsBetween('2025-08-10', '2025-08-17')).toBe(7);
    });

    test('calculates 1 night (edge case)', () => {
        expect(nightsBetween('2025-09-01', '2025-09-02')).toBe(1);
    });

    test('returns 0 for same date', () => {
        expect(nightsBetween('2025-07-01', '2025-07-01')).toBe(0);
    });

    test('returns negative for reversed dates', () => {
        expect(nightsBetween('2025-07-05', '2025-07-01')).toBeLessThan(0);
    });
});

/* ================================================================
   calcPrice
================================================================ */
describe('calcPrice', () => {
    test('calculates 2-night stay at base rate', () => {
        const result = calcPrice(2, 185);
        expect(result).not.toBeNull();
        expect(result.nights).toBe(2);
        expect(result.base).toBe(370);           // 185 × 2
        expect(result.clean).toBe(75);           // fixed
        expect(result.svc).toBe(Math.round(370 * 0.14));    // 52
        const subtotal = 370 + 75 + 52;
        expect(result.taxes).toBe(Math.round(subtotal * 0.115));
        expect(result.total).toBe(370 + 75 + result.svc + result.taxes);
        expect(result.pricePerNight).toBe(185);
    });

    test('calculates 5-night stay correctly', () => {
        const result = calcPrice(5, 185);
        expect(result.nights).toBe(5);
        expect(result.base).toBe(925);           // 185 × 5
        expect(result.svc).toBe(Math.round(925 * 0.14));
        expect(result.total).toBeGreaterThan(result.base);
    });

    test('total equals sum of all components', () => {
        const result = calcPrice(3, 200);
        expect(result.total).toBe(result.base + result.clean + result.svc + result.taxes);
    });

    test('returns null for 0 nights', () => {
        expect(calcPrice(0, 185)).toBeNull();
    });

    test('returns null for negative nights', () => {
        expect(calcPrice(-1, 185)).toBeNull();
    });

    test('returns null for zero price', () => {
        expect(calcPrice(3, 0)).toBeNull();
    });

    test('returns null for negative price', () => {
        expect(calcPrice(3, -50)).toBeNull();
    });

    test('applies custom config override', () => {
        const customConfig = { ...PROPERTY_CONFIG, cleaningFee: 100, serviceFeeRate: 0.10, taxRate: 0.10 };
        const result = calcPrice(3, 200, customConfig);
        expect(result.clean).toBe(100);
        expect(result.svc).toBe(Math.round(600 * 0.10));
    });

    test('service fee is rounded to whole dollar', () => {
        const result = calcPrice(2, 185);
        expect(Number.isInteger(result.svc)).toBe(true);
    });

    test('taxes are rounded to whole dollar', () => {
        const result = calcPrice(2, 185);
        expect(Number.isInteger(result.taxes)).toBe(true);
    });

    test('returns correct pricePerNight', () => {
        const result = calcPrice(4, 250);
        expect(result.pricePerNight).toBe(250);
    });
});

/* ================================================================
   validateDates
================================================================ */
describe('validateDates', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in5Days = new Date();
    in5Days.setDate(in5Days.getDate() + 5);
    const in10Days = new Date();
    in10Days.setDate(in10Days.getDate() + 10);

    const fmt = (d) => d.toISOString().split('T')[0];

    test('accepts valid future dates with enough nights', () => {
        const result = validateDates(fmt(in5Days), fmt(in10Days));
        expect(result.valid).toBe(true);
        expect(result.nights).toBe(5);
    });

    test('rejects missing checkIn', () => {
        const result = validateDates(null, fmt(in10Days));
        expect(result.valid).toBe(false);
        expect(result.error).toBeTruthy();
    });

    test('rejects missing checkOut', () => {
        const result = validateDates(fmt(in5Days), null);
        expect(result.valid).toBe(false);
    });

    test('rejects past check-in date', () => {
        const past = new Date();
        past.setDate(past.getDate() - 2);
        const future = new Date();
        future.setDate(future.getDate() + 5);
        const result = validateDates(fmt(past), fmt(future));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/past/i);
    });

    test('rejects check-out before check-in', () => {
        const result = validateDates(fmt(in10Days), fmt(in5Days));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/after/i);
    });

    test('rejects same-day check-in/out', () => {
        const result = validateDates(fmt(in5Days), fmt(in5Days));
        expect(result.valid).toBe(false);
    });

    test('rejects stay below minimum nights (1 night)', () => {
        const nextDay = new Date(in5Days);
        nextDay.setDate(nextDay.getDate() + 1);
        const result = validateDates(fmt(in5Days), fmt(nextDay));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/minimum/i);
    });

    test('rejects invalid date string', () => {
        const result = validateDates('not-a-date', fmt(in10Days));
        expect(result.valid).toBe(false);
    });

    test('rejects stay exceeding max nights', () => {
        const far = new Date();
        far.setDate(far.getDate() + 60);
        const result = validateDates(fmt(in5Days), fmt(far));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/maximum/i);
    });
});

/* ================================================================
   validateGuests
================================================================ */
describe('validateGuests', () => {
    test('accepts valid guest count', () => {
        expect(validateGuests(2).valid).toBe(true);
        expect(validateGuests(4).valid).toBe(true);
        expect(validateGuests(1).valid).toBe(true);
    });

    test('rejects 0 guests', () => {
        expect(validateGuests(0).valid).toBe(false);
    });

    test('rejects more than maxGuests', () => {
        const result = validateGuests(5);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/maximum/i);
    });

    test('rejects non-numeric input', () => {
        expect(validateGuests('abc').valid).toBe(false);
    });

    test('accepts string number', () => {
        expect(validateGuests('3').valid).toBe(true);
    });
});
