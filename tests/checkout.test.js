/**
 * checkout.test.js — Integration tests for Stripe Checkout API endpoints
 * Uses supertest + jest.mock to simulate Stripe without real API calls.
 */

const request = require('supertest');

/* ---- Mock Stripe before requiring server ---- */
jest.mock('stripe', () => {
    const mockCreate   = jest.fn();
    const mockRetrieve = jest.fn();

    return jest.fn(() => ({
        checkout: {
            sessions: {
                create:   mockCreate,
                retrieve: mockRetrieve,
            },
        },
    }));
});

/* ---- Set env vars before requiring server ---- */
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_tests';
process.env.BASE_URL          = 'http://localhost:3000';

const stripe = require('stripe')(); // get the mock instance
const app    = require('../server');

/* ================================================================
   Shared test data
================================================================ */
const validPayload = {
    checkIn:        '2026-08-01',
    checkOut:       '2026-08-04',
    guests:         2,
    nights:         3,
    pricePerNight:  185,
    cleaning:       75,
    serviceFee:     78,
    taxes:          92,
    total:          800,
    guestName:      'Jane Smith',
    guestEmail:     'jane@example.com',
};

const mockSession = {
    id:             'cs_test_abc123',
    url:            'https://checkout.stripe.com/pay/cs_test_abc123',
    payment_status: 'unpaid',
    customer_email: 'jane@example.com',
    amount_total:   80000,
    metadata: {
        checkIn:        '2026-08-01',
        checkOut:       '2026-08-04',
        guests:         '2',
        nights:         '3',
        guestName:      'Jane Smith',
        pricePerNight:  '185',
    },
};

/* ================================================================
   POST /api/create-checkout-session
================================================================ */
describe('POST /api/create-checkout-session', () => {

    beforeEach(() => {
        stripe.checkout.sessions.create.mockResolvedValue(mockSession);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns 200 and Stripe URL for valid payload', async () => {
        const res = await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        expect(res.status).toBe(200);
        expect(res.body.url).toBe('https://checkout.stripe.com/pay/cs_test_abc123');
        expect(res.body.sessionId).toBe('cs_test_abc123');
    });

    test('calls stripe.checkout.sessions.create once', async () => {
        await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });

    test('includes card, klarna, affirm as payment methods', async () => {
        await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(callArgs.payment_method_types).toContain('card');
        expect(callArgs.payment_method_types).toContain('klarna');
        expect(callArgs.payment_method_types).toContain('affirm');
    });

    test('passes customer_email to Stripe', async () => {
        await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(callArgs.customer_email).toBe('jane@example.com');
    });

    test('success_url includes {CHECKOUT_SESSION_ID} placeholder', async () => {
        await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(callArgs.success_url).toContain('{CHECKOUT_SESSION_ID}');
        expect(callArgs.success_url).toContain('success.html');
    });

    test('cancel_url points back to index.html', async () => {
        await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(callArgs.cancel_url).toContain('rental.html');
    });

    test('metadata includes checkIn and checkOut', async () => {
        await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(callArgs.metadata.checkIn).toBe('2026-08-01');
        expect(callArgs.metadata.checkOut).toBe('2026-08-04');
    });

    test('returns 400 when email is missing', async () => {
        const payload = { ...validPayload };
        delete payload.guestEmail;

        const res = await request(app)
            .post('/api/create-checkout-session')
            .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
    });

    test('returns 400 for invalid email format', async () => {
        const res = await request(app)
            .post('/api/create-checkout-session')
            .send({ ...validPayload, guestEmail: 'not-an-email' });

        expect(res.status).toBe(400);
    });

    test('returns 400 when checkIn is missing', async () => {
        const payload = { ...validPayload };
        delete payload.checkIn;

        const res = await request(app)
            .post('/api/create-checkout-session')
            .send(payload);

        expect(res.status).toBe(400);
    });

    test('returns 400 for past check-in date', async () => {
        const res = await request(app)
            .post('/api/create-checkout-session')
            .send({ ...validPayload, checkIn: '2020-01-01', checkOut: '2020-01-05' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/past/i);
    });

    test('returns 400 for stay shorter than minimum nights', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        const fmt = (d) => d.toISOString().split('T')[0];

        const res = await request(app)
            .post('/api/create-checkout-session')
            .send({ ...validPayload, checkIn: fmt(tomorrow), checkOut: fmt(dayAfter), nights: 1 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/minimum/i);
    });

    test('returns 400 for too many guests', async () => {
        const res = await request(app)
            .post('/api/create-checkout-session')
            .send({ ...validPayload, guests: 10 });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/maximum/i);
    });

    test('returns 500 when Stripe throws an error', async () => {
        stripe.checkout.sessions.create.mockRejectedValueOnce(new Error('Stripe API error'));

        const res = await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Stripe API error');
    });

    test('line items include 4 entries (nightly, cleaning, service, tax)', async () => {
        await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
        expect(callArgs.line_items).toHaveLength(4);
    });

    test('line item amounts are in cents', async () => {
        await request(app)
            .post('/api/create-checkout-session')
            .send(validPayload);

        const callArgs = stripe.checkout.sessions.create.mock.calls[0][0];
        const nightlyItem = callArgs.line_items[0];
        // 185 × 3 = 555 → 55500 cents
        expect(nightlyItem.price_data.unit_amount).toBe(55500);
    });
});

/* ================================================================
   GET /api/session/:id
================================================================ */
describe('GET /api/session/:id', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('returns session data for valid session ID', async () => {
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            id:             'cs_test_abc123',
            payment_status: 'paid',
            customer_email: 'jane@example.com',
            metadata:       mockSession.metadata,
            amount_total:   80000,
        });

        const res = await request(app).get('/api/session/cs_test_abc123');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('cs_test_abc123');
        expect(res.body.status).toBe('paid');
        expect(res.body.customerEmail).toBe('jane@example.com');
        expect(res.body.amountTotal).toBe(80000);
    });

    test('returns metadata with booking details', async () => {
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            id:             'cs_test_abc123',
            payment_status: 'paid',
            customer_email: 'jane@example.com',
            metadata:       mockSession.metadata,
            amount_total:   80000,
        });

        const res = await request(app).get('/api/session/cs_test_abc123');

        expect(res.body.metadata.checkIn).toBe('2026-08-01');
        expect(res.body.metadata.checkOut).toBe('2026-08-04');
    });

    test('returns 404 for invalid session ID', async () => {
        stripe.checkout.sessions.retrieve.mockRejectedValueOnce(new Error('No such session'));

        const res = await request(app).get('/api/session/cs_invalid');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Session not found');
    });
});

/* ================================================================
   GET /api/health
================================================================ */
describe('GET /api/health', () => {
    test('returns status ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    test('reports test mode when using test key', async () => {
        const res = await request(app).get('/api/health');
        expect(res.body.stripe).toBe('test');
    });

    test('includes timestamp', async () => {
        const res = await request(app).get('/api/health');
        expect(res.body.ts).toBeTruthy();
        expect(new Date(res.body.ts).getTime()).not.toBeNaN();
    });
});
