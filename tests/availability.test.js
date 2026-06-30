/**
 * availability.test.js — Unit tests for date availability and blocking logic
 */

const {
    rangeHasBlockedDate,
    expandReservationDates,
    nightsBetween,
} = require('../lib/pricing');

/* ================================================================
   rangeHasBlockedDate
================================================================ */
describe('rangeHasBlockedDate', () => {

    test('returns false when no dates are blocked', () => {
        expect(rangeHasBlockedDate('2026-07-01', '2026-07-05', [])).toBe(false);
    });

    test('returns false when blocked dates are outside the range', () => {
        const blocked = ['2026-06-30', '2026-07-06'];
        expect(rangeHasBlockedDate('2026-07-01', '2026-07-05', blocked)).toBe(false);
    });

    test('returns true when a blocked date falls inside the range', () => {
        const blocked = ['2026-07-03'];
        expect(rangeHasBlockedDate('2026-07-01', '2026-07-05', blocked)).toBe(true);
    });

    test('returns true when check-in date itself is blocked', () => {
        const blocked = ['2026-07-01'];
        expect(rangeHasBlockedDate('2026-07-01', '2026-07-04', blocked)).toBe(true);
    });

    test('returns false when only the check-out date is blocked (check-out not included)', () => {
        const blocked = ['2026-07-05'];
        expect(rangeHasBlockedDate('2026-07-01', '2026-07-05', blocked)).toBe(false);
    });

    test('returns true for single-night overlap', () => {
        const blocked = ['2026-07-02'];
        expect(rangeHasBlockedDate('2026-07-02', '2026-07-03', blocked)).toBe(true);
    });

    test('returns false for empty range (same day)', () => {
        const blocked = ['2026-07-01'];
        // Same day check-in/out means 0 nights — range loop never runs
        expect(rangeHasBlockedDate('2026-07-01', '2026-07-01', blocked)).toBe(false);
    });

    test('handles large blocked date list efficiently', () => {
        const blocked = [];
        for (let i = 1; i <= 100; i++) {
            blocked.push(`2026-09-${String(i).padStart(2, '0')}`);
        }
        // Our range is in July, should not intersect
        expect(rangeHasBlockedDate('2026-07-01', '2026-07-15', blocked)).toBe(false);
    });

    test('handles multiple blocked dates with one overlap', () => {
        const blocked = ['2026-07-10', '2026-07-15', '2026-07-20'];
        expect(rangeHasBlockedDate('2026-07-08', '2026-07-12', blocked)).toBe(true);
    });

    test('returns false when all blocked dates are before range', () => {
        const blocked = ['2026-06-01', '2026-06-15', '2026-06-30'];
        expect(rangeHasBlockedDate('2026-07-01', '2026-07-10', blocked)).toBe(false);
    });
});

/* ================================================================
   expandReservationDates
================================================================ */
describe('expandReservationDates', () => {

    test('expands 2-night stay to 2 dates', () => {
        const dates = expandReservationDates('2026-07-01', '2026-07-03');
        expect(dates).toHaveLength(2);
        expect(dates).toContain('2026-07-01');
        expect(dates).toContain('2026-07-02');
        expect(dates).not.toContain('2026-07-03'); // check-out day not included
    });

    test('expands 5-night stay to 5 dates', () => {
        const dates = expandReservationDates('2026-08-01', '2026-08-06');
        expect(dates).toHaveLength(5);
    });

    test('returns empty array for same-day check-in/out', () => {
        const dates = expandReservationDates('2026-07-01', '2026-07-01');
        expect(dates).toHaveLength(0);
    });

    test('all dates are valid ISO strings', () => {
        const dates = expandReservationDates('2026-07-01', '2026-07-04');
        dates.forEach((d) => {
            expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(new Date(d + 'T12:00:00').getTime()).not.toBeNaN();
        });
    });

    test('dates are in chronological order', () => {
        const dates = expandReservationDates('2026-07-01', '2026-07-06');
        for (let i = 1; i < dates.length; i++) {
            expect(dates[i] > dates[i - 1]).toBe(true);
        }
    });

    test('handles month boundary crossing', () => {
        const dates = expandReservationDates('2026-07-30', '2026-08-02');
        expect(dates).toHaveLength(3);
        expect(dates).toContain('2026-07-30');
        expect(dates).toContain('2026-07-31');
        expect(dates).toContain('2026-08-01');
    });

    test('handles year boundary crossing', () => {
        const dates = expandReservationDates('2026-12-30', '2027-01-02');
        expect(dates).toHaveLength(3);
        expect(dates).toContain('2026-12-30');
        expect(dates).toContain('2026-12-31');
        expect(dates).toContain('2027-01-01');
    });
});

/* ================================================================
   Double-booking prevention simulation
================================================================ */
describe('double-booking prevention', () => {

    function mergeBlockedAndReservations(adminBlocked, reservations) {
        const all = [...adminBlocked];
        reservations
            .filter((r) => r.status !== 'cancelled')
            .forEach((r) => {
                const dates = expandReservationDates(r.checkIn, r.checkOut);
                all.push(...dates);
            });
        return [...new Set(all)];
    }

    const existingReservations = [
        { checkIn: '2026-07-10', checkOut: '2026-07-14', status: 'confirmed' },
        { checkIn: '2026-07-20', checkOut: '2026-07-23', status: 'confirmed' },
        { checkIn: '2026-08-01', checkOut: '2026-08-05', status: 'cancelled' }, // cancelled — should not block
    ];

    const adminBlocked = ['2026-07-05', '2026-07-06'];

    test('confirmed reservations block their date range', () => {
        const allDisabled = mergeBlockedAndReservations(adminBlocked, existingReservations);
        expect(allDisabled).toContain('2026-07-10');
        expect(allDisabled).toContain('2026-07-11');
        expect(allDisabled).toContain('2026-07-12');
        expect(allDisabled).toContain('2026-07-13');
    });

    test('check-out date of reservation is NOT blocked', () => {
        const allDisabled = mergeBlockedAndReservations(adminBlocked, existingReservations);
        expect(allDisabled).not.toContain('2026-07-14'); // check-out day free
    });

    test('cancelled reservations do not block dates', () => {
        const allDisabled = mergeBlockedAndReservations(adminBlocked, existingReservations);
        expect(allDisabled).not.toContain('2026-08-01');
        expect(allDisabled).not.toContain('2026-08-02');
    });

    test('admin-blocked dates are included', () => {
        const allDisabled = mergeBlockedAndReservations(adminBlocked, existingReservations);
        expect(allDisabled).toContain('2026-07-05');
        expect(allDisabled).toContain('2026-07-06');
    });

    test('new booking overlapping confirmed reservation is detected', () => {
        const allDisabled = mergeBlockedAndReservations(adminBlocked, existingReservations);
        // New booking: July 12–16 overlaps existing July 10–14
        expect(rangeHasBlockedDate('2026-07-12', '2026-07-16', allDisabled)).toBe(true);
    });

    test('new booking in free window is allowed', () => {
        const allDisabled = mergeBlockedAndReservations(adminBlocked, existingReservations);
        // July 15–19: gap between first (ends 14th) and second (starts 20th)
        expect(rangeHasBlockedDate('2026-07-15', '2026-07-19', allDisabled)).toBe(false);
    });

    test('no duplicate dates in merged list', () => {
        // Two reservations sharing adjacent dates
        const reservations = [
            { checkIn: '2026-07-01', checkOut: '2026-07-05', status: 'confirmed' },
            { checkIn: '2026-07-01', checkOut: '2026-07-03', status: 'confirmed' }, // overlapping
        ];
        const allDisabled = mergeBlockedAndReservations([], reservations);
        const unique = new Set(allDisabled);
        expect(unique.size).toBe(allDisabled.length);
    });
});
