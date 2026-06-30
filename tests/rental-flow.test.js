/**
 * rental-flow.test.js — Full rental flow integration tests
 */

'use strict';

const request = require('supertest');
const { calcPrice, validateDates, validateGuests, PROPERTY_CONFIG } = require('../lib/pricing');

let mockFlowCaptured = {};
let mockFlowMeta = {};

jest.mock('stripe', () => {
    return jest.fn(() => ({
        checkout: {
            sessions: {
                create: jest.fn(async (params) => {
                    mockFlowCaptured = params;
                    mockFlowMeta = params.metadata || {};
                    return { id: 'cs_flow_test_001', url: 'https://checkout.stripe.com/pay/cs_flow_test_001' };
                }),
                retrieve: jest.fn(async (id) => {
                    if (id === 'cs_flow_test_001') {
                        const total = (mockFlowCaptured.line_items || [])
                            .reduce((s, li) => s + li.price_data.unit_amount, 0);
                        return {
                            id,
                            payment_status: 'paid',
                            customer_email: 'guest@example.com',
                            amount_total:   total,
                            metadata:       mockFlowMeta,
                        };
                    }
                    throw new Error('No such checkout.session');
                }),
            },
        },
    }));
});

const app = require('../server');

function futureDate(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
}

beforeEach(() => { mockFlowCaptured = {}; mockFlowMeta = {}; });

/* ── Step 1: Date & Guest Validation ── */
describe('Full Rental Flow — Step 1: Date & Guest Validation', () => {
    test('valid 5-night stay passes date validation', () => {
        const r = validateDates(futureDate(10), futureDate(15), PROPERTY_CONFIG);
        expect(r.valid).toBe(true);
        expect(r.nights).toBe(5);
    });

    test('2 guests passes', () => { expect(validateGuests(2, PROPERTY_CONFIG).valid).toBe(true); });
    test('1 guest (min) passes', () => { expect(validateGuests(1, PROPERTY_CONFIG).valid).toBe(true); });
    test('4 guests (max) passes', () => { expect(validateGuests(4, PROPERTY_CONFIG).valid).toBe(true); });

    test('5 guests fails', () => {
        const r = validateGuests(5, PROPERTY_CONFIG);
        expect(r.valid).toBe(false);
        expect(r.error).toMatch(/maximum/i);
    });

    test('0 guests fails', () => { expect(validateGuests(0, PROPERTY_CONFIG).valid).toBe(false); });

    test('1-night stay fails (minimum is 2)', () => {
        const r = validateDates(futureDate(5), futureDate(6), PROPERTY_CONFIG);
        expect(r.valid).toBe(false);
        expect(r.error).toMatch(/minimum/i);
    });

    test('31-night stay fails (maximum is 30)', () => {
        const r = validateDates(futureDate(5), futureDate(36), PROPERTY_CONFIG);
        expect(r.valid).toBe(false);
        expect(r.error).toMatch(/maximum/i);
    });

    test('past check-in date fails', () => {
        const r = validateDates('2020-01-01', '2020-01-05', PROPERTY_CONFIG);
        expect(r.valid).toBe(false);
        expect(r.error).toMatch(/past/i);
    });
});

/* ── Step 2: Server-side Price Calculation ── */
describe('Full Rental Flow — Step 2: Server-side Price Calculation', () => {
    test('calcPrice returns all components for 3-night stay at $185/night', () => {
        const p = calcPrice(3, 185);
        expect(p).not.toBeNull();
        expect(p.nights).toBe(3);
        expect(p.base).toBe(555);
        expect(p.clean).toBe(75);
        expect(p.svc).toBe(78); // round(555 × 0.14) = 77.7 → 78
        expect(p.taxes).toBeGreaterThan(0);
        expect(p.total).toBe(p.base + p.clean + p.svc + p.taxes);
    });

    test('calcPrice matches manual calculation for 7 nights', () => {
        const p     = calcPrice(7, 185);
        const base  = 7 * 185;
        const clean = 75;
        const svc   = Math.round(base * 0.14);
        const taxes = Math.round((base + clean + svc) * 0.115);
        expect(p.base).toBe(base);
        expect(p.clean).toBe(clean);
        expect(p.svc).toBe(svc);
        expect(p.taxes).toBe(taxes);
        expect(p.total).toBe(base + clean + svc + taxes);
    });

    test('calcPrice returns null for 0 nights', () => { expect(calcPrice(0, 185)).toBeNull(); });
    test('calcPrice returns null for 0 price per night', () => { expect(calcPrice(3, 0)).toBeNull(); });
});

/* ── Step 3: Create Checkout Session ── */
describe('Full Rental Flow — Step 3: Create Checkout Session', () => {
    const CI = futureDate(14);
    const CO = futureDate(17); // 3 nights

    const VALID_BOOKING = {
        checkIn: CI, checkOut: CO, guests: 2,
        pricePerNight: 185, guestName: 'Carlos Rivera', guestEmail: 'carlos@example.com',
    };

    test('returns 200 with Stripe URL and sessionId', async () => {
        const res = await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(res.status).toBe(200);
        expect(res.body.url).toContain('checkout.stripe.com');
        expect(res.body.sessionId).toBe('cs_flow_test_001');
    });

    test('line items total 4 entries (nightly, cleaning, service, tax)', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockFlowCaptured.line_items).toHaveLength(4);
    });

    test('nightly line item: 3 × $185 = 55500 cents', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockFlowCaptured.line_items[0].price_data.unit_amount).toBe(55500);
    });

    test('cleaning fee line item: $75 = 7500 cents', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockFlowCaptured.line_items[1].price_data.unit_amount).toBe(7500);
    });

    test('service fee line item is ~14% of nightly base', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        const svc      = mockFlowCaptured.line_items[2].price_data.unit_amount;
        const expected = Math.round(555 * 0.14 * 100);
        expect(Math.abs(svc - expected)).toBeLessThanOrEqual(100);
    });

    test('tax line item is > 0 and labeled with "tax"', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        const taxLine = mockFlowCaptured.line_items[3];
        expect(taxLine.price_data.unit_amount).toBeGreaterThan(0);
        expect(taxLine.price_data.product_data.name).toMatch(/tax/i);
    });

    test('session payment mode is "payment"', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockFlowCaptured.mode).toBe('payment');
    });

    test('server recalculates fees from the provided pricePerNight (all 4 line items present)', async () => {
        // The server re-calculates cleaning, service fee, and tax server-side
        // even when pricePerNight comes from the client
        const res = await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(res.status).toBe(200);
        // All 4 fee components are always included
        expect(mockFlowCaptured.line_items).toHaveLength(4);
    });
});

/* ── Step 4: Verify Payment ── */
describe('Full Rental Flow — Step 4: Verify Payment (session retrieval)', () => {
    const CI = futureDate(20);
    const CO = futureDate(23);

    beforeEach(async () => {
        mockFlowCaptured = {}; mockFlowMeta = {};
        await request(app).post('/api/create-checkout-session').send({
            checkIn: CI, checkOut: CO, guests: 2,
            pricePerNight: 185, guestName: 'Ana Colon', guestEmail: 'ana@example.com',
        });
    });

    test('GET /api/session/:id returns payment_status "paid"', async () => {
        const res = await request(app).get('/api/session/cs_flow_test_001');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('paid');
    });

    test('retrieved session has check-in date in metadata', async () => {
        const res = await request(app).get('/api/session/cs_flow_test_001');
        expect(res.body.metadata.checkIn).toBe(CI);
    });

    test('retrieved session has check-out date in metadata', async () => {
        const res = await request(app).get('/api/session/cs_flow_test_001');
        expect(res.body.metadata.checkOut).toBe(CO);
    });

    test('retrieved session has guest count in metadata', async () => {
        const res = await request(app).get('/api/session/cs_flow_test_001');
        expect(res.body.metadata.guests).toBe('2');
    });

    test('retrieved session amountTotal > 0', async () => {
        const res = await request(app).get('/api/session/cs_flow_test_001');
        expect(res.body.amountTotal).toBeGreaterThan(0);
    });

    test('GET /api/session/:id returns 404 for unknown session', async () => {
        const res = await request(app).get('/api/session/cs_nonexistent_999');
        expect(res.status).toBe(404);
    });
});

/* ── Edge Cases ── */
describe('Full Rental Flow — Edge Cases', () => {
    test('booking with special characters in guest name succeeds', async () => {
        const res = await request(app).post('/api/create-checkout-session').send({
            checkIn: futureDate(7), checkOut: futureDate(10), guests: 1,
            pricePerNight: 185, guestName: "O'Brien-García", guestEmail: 'obriengarcia@test.com',
        });
        expect(res.status).toBe(200);
    });

    test('booking with 4 guests (maximum) succeeds', async () => {
        const res = await request(app).post('/api/create-checkout-session').send({
            checkIn: futureDate(7), checkOut: futureDate(9), guests: 4,
            pricePerNight: 185, guestName: 'Family', guestEmail: 'family@test.com',
        });
        expect(res.status).toBe(200);
    });

    test('booking with 30 nights (maximum) succeeds', async () => {
        const res = await request(app).post('/api/create-checkout-session').send({
            checkIn: futureDate(5), checkOut: futureDate(35), guests: 2,
            pricePerNight: 185, guestName: 'Long Stay', guestEmail: 'longstay@test.com',
        });
        expect(res.status).toBe(200);
    });
});
