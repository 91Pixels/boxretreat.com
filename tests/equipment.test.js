/**
 * equipment.test.js — Tests for /api/create-equipment-session endpoint
 */

'use strict';

const request = require('supertest');

// mockCapturedParams is prefixed with 'mock' so jest.mock factory can access it
let mockCapturedParams = {};

jest.mock('stripe', () => {
    return jest.fn(() => ({
        checkout: {
            sessions: {
                create: jest.fn(async (params) => {
                    mockCapturedParams = params;
                    return { id: 'cs_equip_001', url: 'https://checkout.stripe.com/pay/cs_equip_001' };
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

const CI = futureDate(5);
const CO = futureDate(8); // 3 nights

const VALID_PAYLOAD = {
    checkIn:  CI,
    checkOut: CO,
    nights:   3,
    items: [
        { name: 'Shortboard', pricePerUnit: 35, qty: 1 },
        { name: 'Snorkel Set', pricePerUnit: 25, qty: 2 },
    ],
};

beforeEach(() => { mockCapturedParams = {}; });

describe('POST /api/create-equipment-session — validation', () => {
    test('returns 200 with url and sessionId for valid payload', async () => {
        const res = await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(res.status).toBe(200);
        expect(res.body.url).toContain('checkout.stripe.com');
        expect(res.body.sessionId).toBe('cs_equip_001');
    });

    test('returns 400 when items array is empty', async () => {
        const res = await request(app).post('/api/create-equipment-session').send({ ...VALID_PAYLOAD, items: [] });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/no items/i);
    });

    test('returns 400 when items array is missing', async () => {
        const { items: _, ...noItems } = VALID_PAYLOAD;
        const res = await request(app).post('/api/create-equipment-session').send(noItems);
        expect(res.status).toBe(400);
    });

    test('returns 400 when checkIn is missing', async () => {
        const { checkIn: _, ...noCI } = VALID_PAYLOAD;
        const res = await request(app).post('/api/create-equipment-session').send(noCI);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/dates/i);
    });

    test('returns 400 when checkOut is missing', async () => {
        const { checkOut: _, ...noCO } = VALID_PAYLOAD;
        const res = await request(app).post('/api/create-equipment-session').send(noCO);
        expect(res.status).toBe(400);
    });
});

describe('POST /api/create-equipment-session — line items', () => {
    test('line items include one entry per equipment item plus service fee', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(mockCapturedParams.line_items.length).toBe(3); // 2 items + 1 svc fee
    });

    test('Shortboard: $35 × 1 qty × 3 nights = 10500 cents', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(mockCapturedParams.line_items[0].price_data.unit_amount).toBe(10500);
    });

    test('Snorkel Set: $25 × 2 qty × 3 nights = 15000 cents', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(mockCapturedParams.line_items[1].price_data.unit_amount).toBe(15000);
    });

    test('service fee line item is appended at 14%', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        const last = mockCapturedParams.line_items[mockCapturedParams.line_items.length - 1];
        expect(last.price_data.product_data.name).toMatch(/service fee/i);
        // subtotal $255 × 14% = $35.70 → round → $36 → 3600 cents
        expect(last.price_data.unit_amount).toBe(3600);
    });

    test('all line items use USD currency', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        mockCapturedParams.line_items.forEach(li => {
            expect(li.price_data.currency).toBe('usd');
        });
    });

    test('product description contains check-in and check-out dates', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        const desc = mockCapturedParams.line_items[0].price_data.product_data.description;
        expect(desc).toContain(CI);
        expect(desc).toContain(CO);
    });
});

describe('POST /api/create-equipment-session — Stripe session config', () => {
    test('accepts card, klarna, and affirm payment methods', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(mockCapturedParams.payment_method_types).toContain('card');
        expect(mockCapturedParams.payment_method_types).toContain('klarna');
        expect(mockCapturedParams.payment_method_types).toContain('affirm');
    });

    test('metadata records check-in and check-out dates', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(mockCapturedParams.metadata.checkIn).toBe(CI);
        expect(mockCapturedParams.metadata.checkOut).toBe(CO);
    });

    test('metadata type is "equipment"', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(mockCapturedParams.metadata.type).toBe('equipment');
    });

    test('success_url points to shop.html with equipment_success flag', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(mockCapturedParams.success_url).toMatch(/shop\.html\?equipment_success=1/);
    });

    test('cancel_url points back to shop.html', async () => {
        await request(app).post('/api/create-equipment-session').send(VALID_PAYLOAD);
        expect(mockCapturedParams.cancel_url).toMatch(/shop\.html/);
    });
});

describe('POST /api/create-equipment-session — single item', () => {
    test('single item still creates a valid session', async () => {
        const singleItem = {
            ...VALID_PAYLOAD,
            nights: 1,
            items: [{ name: 'Beach Chair', pricePerUnit: 10, qty: 1 }],
        };
        const res = await request(app).post('/api/create-equipment-session').send(singleItem);
        expect(res.status).toBe(200);
    });
});
