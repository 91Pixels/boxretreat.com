/**
 * security-roles.test.js
 * ─────────────────────────────────────────────────────────────────
 * RBAC (Role-Based Access Control) tests for financial API endpoints.
 *
 * Strategy:
 *   Dev/test:   x-user-role header controls access (no DB needed).
 *   Production: swap for JWT (Authorization: Bearer <supabase-jwt>).
 *
 * Endpoints under test (all require admin role):
 *   POST /api/leads        — register converted lead with P&L
 *   POST /api/costs        — log cost entry (property/product/adspend)
 *   GET  /api/reports/pnl  — P&L report for a date range
 *
 * Run: npx jest tests/security-roles.test.js --verbose
 */

'use strict';

const request = require('supertest');

/* Mock Stripe so server.js can load without a real API key */
jest.mock('stripe', () =>
    jest.fn(() => ({ checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } } }))
);

const app = require('../server');

/* ════════════════════════════════════════════════════════════════
   SHARED FIXTURES
════════════════════════════════════════════════════════════════ */

const validLead = {
    type:       'rental',
    date:       '2026-06-21',
    guestName:  'Test Guest',
    guestEmail: 'guest@test.com',
    revenue:    150,
    costCPA:    70,
    opCost:     30,
    cogs:       0,
    source:     'meta',
    campaign:   'Summer Surf',
};

const validCost = {
    type:        'adspend',
    date:        '2026-06-21',
    description: 'Meta daily campaign',
    amount:      10,
    platform:    'meta',
};

const pnlQuery = '?from=2026-06-01&to=2026-06-30';

/* ════════════════════════════════════════════════════════════════
   1. POST /api/leads — Role Gate
════════════════════════════════════════════════════════════════ */

describe('POST /api/leads — role-based access control', () => {

    test('CLIENT role receives 403 Forbidden', async () => {
        const res = await request(app)
            .post('/api/leads')
            .set('x-user-role', 'client')
            .send(validLead);

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Forbidden');
        expect(res.body.message).toMatch(/Admin role required/i);
    });

    test('No role header receives 403 Forbidden', async () => {
        const res = await request(app)
            .post('/api/leads')
            .send(validLead);

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Forbidden');
    });

    test('Spoofed role "superuser" receives 403 Forbidden', async () => {
        const res = await request(app)
            .post('/api/leads')
            .set('x-user-role', 'superuser')
            .send(validLead);

        expect(res.status).toBe(403);
    });

    test('ADMIN role receives 200 and computed P&L', async () => {
        const res = await request(app)
            .post('/api/leads')
            .set('x-user-role', 'admin')
            .send(validLead);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('lead');
        expect(res.body.lead.revenue).toBe(150);
        expect(res.body.lead.totalCost).toBe(100);   // 70 + 30 + 0
        expect(res.body.lead.netProfit).toBe(50);    // 150 - 100
    });

    test('ADMIN (mixed-case header) is accepted — case-insensitive', async () => {
        const res = await request(app)
            .post('/api/leads')
            .set('x-user-role', 'ADMIN')
            .send(validLead);

        expect(res.status).toBe(200);
    });
});

/* ════════════════════════════════════════════════════════════════
   2. POST /api/costs — Role Gate
════════════════════════════════════════════════════════════════ */

describe('POST /api/costs — role-based access control', () => {

    test('CLIENT role receives 403 Forbidden', async () => {
        const res = await request(app)
            .post('/api/costs')
            .set('x-user-role', 'client')
            .send(validCost);

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Forbidden');
    });

    test('No role header receives 403 Forbidden', async () => {
        const res = await request(app)
            .post('/api/costs')
            .send(validCost);

        expect(res.status).toBe(403);
    });

    test('ADMIN role receives 200 and created entry', async () => {
        const res = await request(app)
            .post('/api/costs')
            .set('x-user-role', 'admin')
            .send(validCost);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('entry');
        expect(res.body.entry.type).toBe('adspend');
        expect(res.body.entry.amount).toBe(10);
    });

    test('ADMIN can log all three cost types', async () => {
        const types = ['property', 'product', 'adspend'];
        for (const type of types) {
            const res = await request(app)
                .post('/api/costs')
                .set('x-user-role', 'admin')
                .send({ ...validCost, type });

            expect(res.status).toBe(200);
            expect(res.body.entry.type).toBe(type);
        }
    });

    test('Invalid cost type returns 400 even for ADMIN', async () => {
        const res = await request(app)
            .post('/api/costs')
            .set('x-user-role', 'admin')
            .send({ ...validCost, type: 'marketing' }); // not in whitelist

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'invalid type');
    });
});

/* ════════════════════════════════════════════════════════════════
   3. GET /api/reports/pnl — Role Gate
════════════════════════════════════════════════════════════════ */

describe('GET /api/reports/pnl — role-based access control', () => {

    test('CLIENT role receives 403 Forbidden', async () => {
        const res = await request(app)
            .get(`/api/reports/pnl${pnlQuery}`)
            .set('x-user-role', 'client');

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error', 'Forbidden');
    });

    test('No role header receives 403 Forbidden', async () => {
        const res = await request(app)
            .get(`/api/reports/pnl${pnlQuery}`);

        expect(res.status).toBe(403);
    });

    test('ADMIN role receives 200 with period and schema', async () => {
        const res = await request(app)
            .get(`/api/reports/pnl${pnlQuery}`)
            .set('x-user-role', 'admin');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('period');
        expect(res.body.period.from).toBe('2026-06-01');
        expect(res.body.period.to).toBe('2026-06-30');
    });

    test('Missing date params returns 400 even for ADMIN', async () => {
        const res = await request(app)
            .get('/api/reports/pnl')
            .set('x-user-role', 'admin');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/date/i);
    });
});

/* ════════════════════════════════════════════════════════════════
   4. Public endpoints remain accessible to all roles
════════════════════════════════════════════════════════════════ */

describe('Public endpoints — no auth required', () => {

    test('GET /api/health returns 200 for anyone', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('GET /api/health returns 200 even with no header', async () => {
        const res = await request(app)
            .get('/api/health')
            .set('x-user-role', 'client');
        expect(res.status).toBe(200);
    });

    test('POST /api/create-checkout-session is accessible to clients', async () => {
        /* Clients must be able to initiate checkout — only financial admin endpoints are gated. */
        const res = await request(app)
            .post('/api/create-checkout-session')
            .set('x-user-role', 'client')
            .send({
                checkIn:       '2027-01-10',
                checkOut:      '2027-01-13',
                guests:        2,
                nights:        3,
                pricePerNight: 185,
                guestEmail:    'surf@test.com',
                guestName:     'Test Surfer',
            });
        /* Any non-403 status confirms the route is not blocked by adminOnly */
        expect(res.status).not.toBe(403);
    });
});
