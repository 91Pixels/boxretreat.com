/**
 * server.js — BoxRetreat Express + Stripe backend
 * Serves the www/ static site and exposes Stripe Checkout API.
 *
 * Start:  npm start          (production)
 *         npm run dev        (hot reload with nodemon)
 *
 * Test mode: set STRIPE_SECRET_KEY=sk_test_... in .env
 * Live mode: set STRIPE_SECRET_KEY=sk_live_... in .env
 */

require('dotenv').config();

const express  = require('express');
const path     = require('path');
const {
    calcPrice,
    validateDates,
    validateGuests,
    rangeHasBlockedDate,
    PROPERTY_CONFIG,
} = require('./lib/pricing');

/* ---- Stripe init ---- */
if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('⚠  STRIPE_SECRET_KEY not set — copy .env.example to .env and add your key.');
}
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const app     = express();
const PORT    = process.env.PORT     || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'www')));

/* ================================================================
   POST /api/create-checkout-session
   Body: { checkIn, checkOut, guests, nights, pricePerNight,
           cleaning, serviceFee, taxes, total, guestName, guestEmail }
================================================================ */
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const {
            checkIn, checkOut, guests,
            nights, pricePerNight,
            cleaning, serviceFee, taxes, total,
            guestName, guestEmail,
        } = req.body;

        /* --- Input validation --- */
        if (!guestEmail || !guestEmail.includes('@')) {
            return res.status(400).json({ error: 'Valid guest email is required' });
        }
        if (!checkIn || !checkOut) {
            return res.status(400).json({ error: 'Check-in and check-out dates are required' });
        }

        const dateCheck = validateDates(checkIn, checkOut, PROPERTY_CONFIG);
        if (!dateCheck.valid) {
            return res.status(400).json({ error: dateCheck.error });
        }
        const guestCheck = validateGuests(guests, PROPERTY_CONFIG);
        if (!guestCheck.valid) {
            return res.status(400).json({ error: guestCheck.error });
        }

        // Re-calculate server-side to prevent price tampering
        const serverPrice = calcPrice(dateCheck.nights, Number(pricePerNight), PROPERTY_CONFIG);
        if (!serverPrice) {
            return res.status(400).json({ error: 'Could not calculate price' });
        }

        const nightlyBase = serverPrice.base;

        /* --- Build Stripe line items --- */
        const lineItems = [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `BoxRetreat Luquillo — ${serverPrice.nights} night${serverPrice.nights > 1 ? 's' : ''}`,
                        description: `Check-in: ${checkIn} · Check-out: ${checkOut} · ${guests} guest${Number(guests) > 1 ? 's' : ''}`,
                        images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop'],
                    },
                    unit_amount: Math.round(nightlyBase * 100),
                },
                quantity: 1,
            },
            {
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Cleaning fee' },
                    unit_amount: Math.round(serverPrice.clean * 100),
                },
                quantity: 1,
            },
            {
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Service fee (14%)' },
                    unit_amount: Math.round(serverPrice.svc * 100),
                },
                quantity: 1,
            },
            {
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Puerto Rico hotel tax (11.5%)' },
                    unit_amount: Math.round(serverPrice.taxes * 100),
                },
                quantity: 1,
            },
        ];

        /* --- Create Stripe Checkout session --- */
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'klarna', 'affirm'],
            customer_email: guestEmail,
            mode: 'payment',
            line_items: lineItems,
            success_url: `${BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${BASE_URL}/?cancelled=1`,
            metadata: {
                checkIn,
                checkOut,
                guests:        String(guests),
                nights:        String(serverPrice.nights),
                guestName:     guestName || '',
                pricePerNight: String(serverPrice.pricePerNight),
                base:          String(serverPrice.base),
                clean:         String(serverPrice.clean),
                svc:           String(serverPrice.svc),
                taxes:         String(serverPrice.taxes),
                total:         String(serverPrice.total),
            },
            billing_address_collection: 'auto',
            phone_number_collection: { enabled: true },
        });

        res.json({ url: session.url, sessionId: session.id });

    } catch (err) {
        console.error('[Stripe] create-session error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/* ================================================================
   POST /api/create-equipment-session
   Equipment rental checkout via Stripe
================================================================ */
app.post('/api/create-equipment-session', async (req, res) => {
    try {
        const { items, checkIn, checkOut, nights } = req.body;
        if (!items || !items.length) return res.status(400).json({ error: 'No items provided' });
        if (!checkIn || !checkOut) return res.status(400).json({ error: 'Dates required' });

        const lineItems = items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `${item.name} × ${item.qty}`,
                    description: `${nights} night${nights > 1 ? 's' : ''} rental (${checkIn} – ${checkOut})`,
                },
                unit_amount: Math.round(item.pricePerUnit * item.qty * nights * 100),
            },
            quantity: 1,
        }));

        const svcTotal = Math.round(items.reduce((s, i) => s + i.pricePerUnit * i.qty * nights, 0) * 0.14);
        if (svcTotal > 0) {
            lineItems.push({
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Service fee (14%)' },
                    unit_amount: svcTotal * 100,
                },
                quantity: 1,
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'klarna', 'affirm'],
            mode: 'payment',
            line_items: lineItems,
            success_url: `${BASE_URL}/shop.html?equipment_success=1&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${BASE_URL}/shop.html?cancelled=1`,
            metadata: { checkIn, checkOut, nights: String(nights), type: 'equipment' },
            phone_number_collection: { enabled: true },
        });

        res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
        console.error('[Stripe] equipment-session error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

/* ================================================================
   GET /api/session/:id
   Retrieve session after Stripe redirect — verify payment status
================================================================ */
app.get('/api/session/:id', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.retrieve(req.params.id);
        res.json({
            id:            session.id,
            status:        session.payment_status,
            customerEmail: session.customer_email,
            metadata:      session.metadata,
            amountTotal:   session.amount_total,
        });
    } catch (err) {
        console.error('[Stripe] retrieve-session error:', err.message);
        res.status(404).json({ error: 'Session not found' });
    }
});

/* ================================================================
   MIDDLEWARE — Admin-only financial endpoints
   Dev/test: pass  x-user-role: admin  header.
   Production: swap for JWT verification against Supabase JWT secret.
================================================================ */
function adminOnly(req, res, next) {
    const role = (req.headers['x-user-role'] || '').toLowerCase().trim();

    /* Production path (when Supabase JWT is present):
       const token = (req.headers['authorization'] || '').replace('Bearer ', '');
       if (token) {
           const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
           if (decoded?.role === 'admin') return next();
       }
    */

    if (role === 'admin') return next();

    return res.status(403).json({
        error:   'Forbidden',
        message: 'Admin role required. Clients do not have access to financial data.',
        hint:    'Send header: x-user-role: admin (dev) or a valid admin JWT (prod).',
    });
}

/* ================================================================
   POST /api/leads
   Register a converted lead with full P&L breakdown.
   Body: { type, date, reservationId, guestName, guestEmail,
           revenue, costCPA, opCost, cogs, source, campaign }
================================================================ */
app.post('/api/leads', adminOnly, (req, res) => {
    const { type, date, reservationId, guestName, guestEmail,
            revenue, costCPA, opCost, cogs, source, campaign } = req.body;

    if (!date)             return res.status(400).json({ error: 'date required' });
    if (!revenue || revenue <= 0) return res.status(400).json({ error: 'revenue must be > 0' });

    const id        = 'LEAD-' + Date.now().toString(36).toUpperCase();
    const totalCost = (Number(costCPA) || 0) + (Number(opCost) || 0) + (Number(cogs) || 0);
    const netProfit = Number(revenue) - totalCost;

    const lead = {
        id, type: type || 'rental', date,
        reservationId: reservationId || null,
        guestName: guestName || '', guestEmail: guestEmail || '',
        revenue: Number(revenue), costCPA: Number(costCPA) || 0,
        opCost: Number(opCost) || 0, cogs: Number(cogs) || 0,
        totalCost, netProfit,
        source: source || 'direct', campaign: campaign || '',
        createdAt: new Date().toISOString(),
    };

    /* In production: persist to Supabase leads table via service-role key.
       For now, return the computed object so the browser can store it. */
    res.json({ lead });
});

/* ================================================================
   POST /api/costs
   Log a cost entry (property / product / adspend).
   Body: { type, date, description, amount, platform?, campaign? }
================================================================ */
app.post('/api/costs', adminOnly, (req, res) => {
    const { type, date, description, amount, platform, campaign,
            productId, units, unitCost } = req.body;

    if (!date)   return res.status(400).json({ error: 'date required' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'amount must be > 0' });

    const validTypes = ['property', 'product', 'adspend'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'invalid type' });

    const entry = {
        id:          'COST-' + Date.now().toString(36).toUpperCase(),
        type, date, description: description || '',
        amount:      Number(amount),
        platform:    platform   || null,
        campaign:    campaign   || null,
        productId:   productId  || null,
        units:       units      || null,
        unitCost:    unitCost   || null,
        createdAt:   new Date().toISOString(),
    };

    res.json({ entry });
});

/* ================================================================
   GET /api/reports/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD
   Server-side P&L calculation. In production, queries Supabase
   v_daily_pnl or v_monthly_pnl views. For local use, this endpoint
   documents the expected response shape.
================================================================ */
app.get('/api/reports/pnl', adminOnly, (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates required (YYYY-MM-DD)' });

    /* Example response shape — replace with Supabase query in production */
    res.json({
        period: { from, to },
        note: 'Connect Supabase service-role key to query v_daily_pnl or v_monthly_pnl views.',
        schema: {
            revenue:    'number — gross revenue from leads in range',
            costs:      '{ adSpend, opCost, cogs, total }',
            profit:     '{ net, margin }',
            kpis:       '{ roi, cpa, avgOrderValue, leads }',
            daily:      '[{ date, revenue, costs }] — for chart data',
            bySource:   '{ meta, google, tiktok, organic, direct }',
        },
    });
});

/* ================================================================
   GET /api/health
   Quick health check for CI / monitoring
================================================================ */
app.get('/api/health', (_req, res) => {
    const mode = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live') ? 'live' : 'test';
    res.json({ status: 'ok', stripe: mode, ts: new Date().toISOString() });
});

/* ---- Fallback: serve index.html for unknown routes ---- */
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

/* ---- Start server (only when run directly, not during tests) ---- */
if (require.main === module) {
    app.listen(PORT, () => {
        const mode = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live') ? '🟢 LIVE' : '🟡 TEST';
        console.log(`\n  BoxRetreat server  →  http://localhost:${PORT}`);
        console.log(`  Stripe mode        →  ${mode}`);
        console.log(`  Admin panel        →  http://localhost:${PORT}/admin.html\n`);
    });
}

module.exports = app; // exported for supertest
