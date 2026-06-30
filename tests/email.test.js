/**
 * email.test.js — Tests for email notification logic
 */

'use strict';

const request = require('supertest');

let mockEmailCaptured = {};

jest.mock('stripe', () => {
    return jest.fn(() => ({
        checkout: {
            sessions: {
                create: jest.fn(async (params) => {
                    mockEmailCaptured = params;
                    return {
                        id:  'cs_email_test_001',
                        url: 'https://checkout.stripe.com/pay/cs_email_test_001',
                    };
                }),
                retrieve: jest.fn(async () => ({
                    id: 'cs_email_test_001',
                    payment_status: 'paid',
                })),
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

const FUTURE_CI = futureDate(10);
const FUTURE_CO = futureDate(13); // 3 nights

const VALID_BOOKING = {
    checkIn:       FUTURE_CI,
    checkOut:      FUTURE_CO,
    guests:        2,
    pricePerNight: 185,
    guestName:     'Maria Garcia',
    guestEmail:    'maria@example.com',
};

beforeEach(() => { mockEmailCaptured = {}; });

describe('Email — customer_email on Stripe session (Stripe receipt)', () => {
    test('checkout session is created when email is valid', async () => {
        const res = await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(res.status).toBe(200);
        expect(res.body.sessionId).toBeDefined();
    });

    test('checkout session is rejected when email is missing', async () => {
        const res = await request(app).post('/api/create-checkout-session').send({ ...VALID_BOOKING, guestEmail: '' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
    });

    test('checkout session is rejected when email has no @ sign', async () => {
        const res = await request(app).post('/api/create-checkout-session').send({ ...VALID_BOOKING, guestEmail: 'notanemail' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
    });

    test('customer_email passed to Stripe matches the guest email', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockEmailCaptured.customer_email).toBe('maria@example.com');
    });
});

describe('Email — booking metadata completeness for confirmation email', () => {
    test('metadata contains checkIn date', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockEmailCaptured.metadata.checkIn).toBe(FUTURE_CI);
    });

    test('metadata contains checkOut date', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockEmailCaptured.metadata.checkOut).toBe(FUTURE_CO);
    });

    test('metadata contains guest name', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockEmailCaptured.metadata.guestName).toBe('Maria Garcia');
    });

    test('metadata contains number of nights (3)', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(Number(mockEmailCaptured.metadata.nights)).toBe(3);
    });

    test('metadata contains total price > 0', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(Number(mockEmailCaptured.metadata.total)).toBeGreaterThan(0);
    });

    test('metadata contains guest count', async () => {
        await request(app).post('/api/create-checkout-session').send(VALID_BOOKING);
        expect(mockEmailCaptured.metadata.guests).toBe('2');
    });
});

describe('Email — contact form field validation', () => {
    function validateContactForm({ name, email, message }) {
        if (!name || name.trim().length < 2)       return { valid: false, error: 'Name is required' };
        if (!email || !email.includes('@'))         return { valid: false, error: 'Valid email is required' };
        if (!message || message.trim().length < 10) return { valid: false, error: 'Message must be at least 10 characters' };
        return { valid: true };
    }

    test('valid form passes all validation', () => {
        const result = validateContactForm({ name: 'John Doe', email: 'john@example.com', message: 'Hello, I have a question about the property.' });
        expect(result.valid).toBe(true);
    });

    test('empty name fails validation', () => {
        const result = validateContactForm({ name: '', email: 'a@b.com', message: 'Test message here.' });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/name/i);
    });

    test('invalid email fails validation', () => {
        const result = validateContactForm({ name: 'John', email: 'invalid', message: 'Test message here.' });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/email/i);
    });

    test('short message fails validation', () => {
        const result = validateContactForm({ name: 'John', email: 'j@x.com', message: 'Hi' });
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/message/i);
    });

    test('message of exactly 10 characters passes', () => {
        const result = validateContactForm({ name: 'John', email: 'j@x.com', message: '1234567890' });
        expect(result.valid).toBe(true);
    });
});
