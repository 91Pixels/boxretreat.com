/**
 * data-persistence.test.js — Tests for the RentalStore data layer
 *
 * RentalStore persists reservations and blocked dates to localStorage.
 * This file rebuilds that logic in Node (mimicking the browser layer)
 * and tests every CRUD operation and computed view.
 */

'use strict';

/* ── Minimal localStorage stub ── */
class LocalStorageStub {
    constructor() { this._store = {}; }
    getItem(k)       { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; }
    setItem(k, v)    { this._store[k] = String(v); }
    removeItem(k)    { delete this._store[k]; }
    clear()          { this._store = {}; }
}

/* ── Inline RentalStore (mirrors www/js/rental-data.js) ── */
function buildStore(ls) {
    const KEYS = {
        reservations: 'br_reservations',
        blockedDates: 'br_blocked_dates',
        price:        'br_price_per_night',
    };

    const DEFAULT_PRICE = 185;

    function genId() {
        return 'BR-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    }

    return {
        /* ── Reservations ── */
        getReservations() {
            return JSON.parse(ls.getItem(KEYS.reservations) || '[]');
        },
        addReservation(res) {
            const all = this.getReservations();
            const entry = { ...res, id: res.id || genId(), createdAt: new Date().toISOString() };
            all.push(entry);
            ls.setItem(KEYS.reservations, JSON.stringify(all));
            return entry;
        },
        updateReservation(id, changes) {
            const all = this.getReservations().map(r => r.id === id ? { ...r, ...changes } : r);
            ls.setItem(KEYS.reservations, JSON.stringify(all));
        },
        deleteReservation(id) {
            const all = this.getReservations().filter(r => r.id !== id);
            ls.setItem(KEYS.reservations, JSON.stringify(all));
        },

        /* ── Blocked Dates ── */
        getBlockedDates() {
            return JSON.parse(ls.getItem(KEYS.blockedDates) || '[]');
        },
        setBlockedDates(dates) {
            ls.setItem(KEYS.blockedDates, JSON.stringify(dates));
        },
        addBlockedDate(date) {
            const dates = this.getBlockedDates();
            if (!dates.includes(date)) {
                dates.push(date);
                ls.setItem(KEYS.blockedDates, JSON.stringify(dates));
            }
        },
        removeBlockedDate(date) {
            const dates = this.getBlockedDates().filter(d => d !== date);
            ls.setItem(KEYS.blockedDates, JSON.stringify(dates));
        },

        /* ── Pricing ── */
        getCurrentPrice() {
            const stored = ls.getItem(KEYS.price);
            return stored ? Number(stored) : DEFAULT_PRICE;
        },
        setPrice(price) {
            ls.setItem(KEYS.price, String(price));
        },

        /* ── Computed: all disabled dates (blocked + confirmed reservations) ── */
        getAllDisabledDates() {
            const blocked = this.getBlockedDates();
            const confirmed = this.getReservations()
                .filter(r => r.status === 'confirmed')
                .flatMap(r => {
                    const dates = [];
                    const cur = new Date(r.checkIn + 'T12:00:00');
                    const end = new Date(r.checkOut + 'T12:00:00');
                    while (cur < end) {
                        dates.push(cur.toISOString().split('T')[0]);
                        cur.setDate(cur.getDate() + 1);
                    }
                    return dates;
                });
            return [...new Set([...blocked, ...confirmed])];
        },
    };
}

/* ── Test helpers ── */
function makeReservation(overrides = {}) {
    return {
        checkIn:  '2026-09-01',
        checkOut: '2026-09-04',
        guests:   2,
        status:   'confirmed',
        guest:    { name: 'Test Guest', email: 'test@example.com' },
        total:    750,
        ...overrides,
    };
}

/* ════════════════════════════════════════════ */
/* TESTS                                        */
/* ════════════════════════════════════════════ */

describe('RentalStore — Reservations CRUD', () => {
    let ls, store;

    beforeEach(() => {
        ls    = new LocalStorageStub();
        store = buildStore(ls);
    });

    test('getReservations returns empty array when storage is empty', () => {
        expect(store.getReservations()).toEqual([]);
    });

    test('addReservation persists a reservation and returns it with an id', () => {
        const added = store.addReservation(makeReservation());
        expect(added.id).toMatch(/^BR-/);
        expect(store.getReservations()).toHaveLength(1);
    });

    test('addReservation uses provided id if given', () => {
        const added = store.addReservation(makeReservation({ id: 'BR-CUSTOM' }));
        expect(added.id).toBe('BR-CUSTOM');
    });

    test('addReservation stores createdAt timestamp', () => {
        const added = store.addReservation(makeReservation());
        expect(added.createdAt).toBeDefined();
        expect(new Date(added.createdAt).getTime()).not.toBeNaN();
    });

    test('addReservation accumulates multiple reservations', () => {
        store.addReservation(makeReservation({ checkIn: '2026-09-01', checkOut: '2026-09-03' }));
        store.addReservation(makeReservation({ checkIn: '2026-09-10', checkOut: '2026-09-13' }));
        expect(store.getReservations()).toHaveLength(2);
    });

    test('updateReservation changes a specific field', () => {
        const { id } = store.addReservation(makeReservation());
        store.updateReservation(id, { status: 'cancelled' });
        const all = store.getReservations();
        expect(all[0].status).toBe('cancelled');
    });

    test('updateReservation does not affect other reservations', () => {
        const { id: id1 } = store.addReservation(makeReservation({ guest: { name: 'Alice', email: 'alice@test.com' } }));
        const { id: id2 } = store.addReservation(makeReservation({ guest: { name: 'Bob',   email: 'bob@test.com'   } }));
        store.updateReservation(id1, { status: 'cancelled' });
        const bob = store.getReservations().find(r => r.id === id2);
        expect(bob.status).toBe('confirmed');
    });

    test('deleteReservation removes the correct reservation', () => {
        const { id } = store.addReservation(makeReservation());
        store.deleteReservation(id);
        expect(store.getReservations()).toHaveLength(0);
    });

    test('deleteReservation leaves other reservations intact', () => {
        const { id: id1 } = store.addReservation(makeReservation());
        store.addReservation(makeReservation({ checkIn: '2026-10-01', checkOut: '2026-10-04' }));
        store.deleteReservation(id1);
        expect(store.getReservations()).toHaveLength(1);
    });

    test('reservation guest data is stored and retrieved correctly', () => {
        store.addReservation(makeReservation({
            guest: { name: 'María García', email: 'maria@example.com', phone: '+1-787-555-0001' },
        }));
        const saved = store.getReservations()[0];
        expect(saved.guest.name).toBe('María García');
        expect(saved.guest.email).toBe('maria@example.com');
    });
});

describe('RentalStore — Blocked Dates', () => {
    let ls, store;

    beforeEach(() => {
        ls    = new LocalStorageStub();
        store = buildStore(ls);
    });

    test('getBlockedDates returns empty array initially', () => {
        expect(store.getBlockedDates()).toEqual([]);
    });

    test('addBlockedDate adds a date', () => {
        store.addBlockedDate('2026-12-25');
        expect(store.getBlockedDates()).toContain('2026-12-25');
    });

    test('addBlockedDate does not duplicate an existing date', () => {
        store.addBlockedDate('2026-12-25');
        store.addBlockedDate('2026-12-25');
        expect(store.getBlockedDates()).toHaveLength(1);
    });

    test('removeBlockedDate removes the correct date', () => {
        store.addBlockedDate('2026-12-25');
        store.addBlockedDate('2026-12-26');
        store.removeBlockedDate('2026-12-25');
        expect(store.getBlockedDates()).not.toContain('2026-12-25');
        expect(store.getBlockedDates()).toContain('2026-12-26');
    });

    test('setBlockedDates replaces the entire list', () => {
        store.addBlockedDate('2026-11-01');
        store.setBlockedDates(['2026-12-01', '2026-12-02', '2026-12-03']);
        expect(store.getBlockedDates()).toHaveLength(3);
        expect(store.getBlockedDates()).not.toContain('2026-11-01');
    });
});

describe('RentalStore — Dynamic Pricing', () => {
    let ls, store;

    beforeEach(() => {
        ls    = new LocalStorageStub();
        store = buildStore(ls);
    });

    test('getCurrentPrice returns default $185 when nothing is stored', () => {
        expect(store.getCurrentPrice()).toBe(185);
    });

    test('setPrice stores and retrieves custom price', () => {
        store.setPrice(220);
        expect(store.getCurrentPrice()).toBe(220);
    });

    test('setPrice handles decimal prices', () => {
        store.setPrice(199.99);
        expect(store.getCurrentPrice()).toBeCloseTo(199.99);
    });
});

describe('RentalStore — getAllDisabledDates (calendar blocking)', () => {
    let ls, store;

    beforeEach(() => {
        ls    = new LocalStorageStub();
        store = buildStore(ls);
    });

    test('returns empty array when no reservations or blocked dates', () => {
        expect(store.getAllDisabledDates()).toEqual([]);
    });

    test('includes admin-blocked dates', () => {
        store.addBlockedDate('2026-08-15');
        expect(store.getAllDisabledDates()).toContain('2026-08-15');
    });

    test('includes dates occupied by confirmed reservations', () => {
        store.addReservation(makeReservation({ checkIn: '2026-09-01', checkOut: '2026-09-04', status: 'confirmed' }));
        const disabled = store.getAllDisabledDates();
        expect(disabled).toContain('2026-09-01');
        expect(disabled).toContain('2026-09-02');
        expect(disabled).toContain('2026-09-03');
    });

    test('does NOT include check-out date itself', () => {
        store.addReservation(makeReservation({ checkIn: '2026-09-01', checkOut: '2026-09-04', status: 'confirmed' }));
        expect(store.getAllDisabledDates()).not.toContain('2026-09-04');
    });

    test('does NOT include cancelled reservation dates', () => {
        store.addReservation(makeReservation({ checkIn: '2026-09-10', checkOut: '2026-09-13', status: 'cancelled' }));
        const disabled = store.getAllDisabledDates();
        expect(disabled).not.toContain('2026-09-10');
    });

    test('merges blocked dates and confirmed reservation dates without duplicates', () => {
        store.addBlockedDate('2026-09-02');  // overlaps reservation
        store.addReservation(makeReservation({ checkIn: '2026-09-01', checkOut: '2026-09-04', status: 'confirmed' }));
        const disabled = store.getAllDisabledDates();
        const count = disabled.filter(d => d === '2026-09-02').length;
        expect(count).toBe(1);  // no duplicate
    });

    test('multiple confirmed reservations each contribute their dates', () => {
        store.addReservation(makeReservation({ checkIn: '2026-09-01', checkOut: '2026-09-03', status: 'confirmed' }));
        store.addReservation(makeReservation({ checkIn: '2026-09-10', checkOut: '2026-09-12', status: 'confirmed' }));
        const disabled = store.getAllDisabledDates();
        expect(disabled).toContain('2026-09-01');
        expect(disabled).toContain('2026-09-10');
    });
});

describe('RentalStore — User reservation lookup (like Airbnb "My Stays")', () => {
    let ls, store;

    beforeEach(() => {
        ls    = new LocalStorageStub();
        store = buildStore(ls);
    });

    function getMyReservations(email) {
        return store.getReservations().filter(r => {
            const rEmail = r.guest?.email || r.email || '';
            return rEmail.toLowerCase() === email.toLowerCase();
        });
    }

    test('user sees only their own reservations', () => {
        store.addReservation(makeReservation({ guest: { name: 'Alice', email: 'alice@test.com' } }));
        store.addReservation(makeReservation({ guest: { name: 'Bob',   email: 'bob@test.com'   } }));
        expect(getMyReservations('alice@test.com')).toHaveLength(1);
        expect(getMyReservations('bob@test.com')).toHaveLength(1);
    });

    test('user email lookup is case-insensitive', () => {
        store.addReservation(makeReservation({ guest: { name: 'Alice', email: 'Alice@Test.COM' } }));
        expect(getMyReservations('alice@test.com')).toHaveLength(1);
    });

    test('user with no reservations sees empty list', () => {
        store.addReservation(makeReservation({ guest: { name: 'Bob', email: 'bob@test.com' } }));
        expect(getMyReservations('nobody@test.com')).toHaveLength(0);
    });

    test('user with multiple stays sees all of them', () => {
        store.addReservation(makeReservation({ checkIn: '2026-09-01', checkOut: '2026-09-03', guest: { name: 'Alice', email: 'alice@test.com' } }));
        store.addReservation(makeReservation({ checkIn: '2026-11-01', checkOut: '2026-11-05', guest: { name: 'Alice', email: 'alice@test.com' } }));
        expect(getMyReservations('alice@test.com')).toHaveLength(2);
    });

    test('reservation shows correct dates and total for user dashboard', () => {
        store.addReservation(makeReservation({
            checkIn:  '2026-09-01',
            checkOut: '2026-09-05',
            total:    980,
            nights:   4,
            guest:    { name: 'Dana', email: 'dana@test.com' },
        }));
        const [res] = getMyReservations('dana@test.com');
        expect(res.checkIn).toBe('2026-09-01');
        expect(res.checkOut).toBe('2026-09-05');
        expect(res.total).toBe(980);
        expect(res.nights).toBe(4);
    });
});
