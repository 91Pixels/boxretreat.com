/**
 * financial-logic.test.js
 * ─────────────────────────────────────────────────────────────────
 * Unit tests for the financial P&L calculation engine (lib/fin-calc.js).
 *
 * CANONICAL SCENARIO (used throughout this file):
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Day: 2026-06-21                                             │
 * │                                                              │
 * │  INCOME                                                      │
 * │    Rental 1 night @ $150/night              +$150.00         │
 * │    Product: 2 × T-shirt @ $20 each          + $40.00         │
 * │    ─────────────────────────────────────────────────         │
 * │    GROSS REVENUE                             $190.00         │
 * │                                                              │
 * │  COSTS                                                       │
 * │    Property operational cost (cleaning/util) $30.00          │
 * │    COGS: 2 × T-shirt @ $15 unit cost         $30.00          │
 * │    Daily ad spend (Meta campaign)            $10.00          │
 * │    Lead CPA (attributed acquisition cost)    $70.00          │
 * │    ─────────────────────────────────────────────────         │
 * │    TOTAL COSTS                               $140.00         │
 * │                                                              │
 * │  NET PROFIT                                   $50.00         │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Run: npx jest tests/financial-logic.test.js --verbose
 */

'use strict';

const { calcPnL, filterByDate, getDateRange } = require('../lib/fin-calc');

/* ════════════════════════════════════════════════════════════════
   CANONICAL SCENARIO FIXTURES
════════════════════════════════════════════════════════════════ */

const DATE = '2026-06-21';

/* Lead 1 — Rental conversion (1 night @ $150) */
const leadRental = {
    id:        'LEAD-001',
    type:      'rental',
    date:      DATE,
    guestName: 'Ana Rivera',
    revenue:   150,   // nightly rate
    costCPA:   70,    // attributed ad acquisition cost
    opCost:    30,    // property operational cost for this stay
    cogs:      0,
};

/* Lead 2 — Product sale (2 T-shirts @ $20 each) */
const leadProduct = {
    id:        'LEAD-002',
    type:      'product',
    date:      DATE,
    guestName: 'Ana Rivera',
    revenue:   40,    // 2 × $20
    costCPA:   0,
    opCost:    0,
    cogs:      30,    // 2 × $15 unit cost
};

/* Cost entry — Daily Meta ad spend */
const costAdSpend = {
    id:          'COST-001',
    type:        'adspend',
    date:        DATE,
    description: 'Meta Summer Surf campaign',
    amount:      10,
    platform:    'meta',
};

/* ════════════════════════════════════════════════════════════════
   1. CANONICAL P&L ASSERTIONS (exact dollar amounts)
════════════════════════════════════════════════════════════════ */

describe('calcPnL — canonical scenario: $190 revenue, $140 costs, $50 profit', () => {

    let result;

    beforeAll(() => {
        result = calcPnL({
            leads: [leadRental, leadProduct],
            costs: [costAdSpend],
        });
    });

    /* ── Revenue ── */
    test('rental revenue is $150', () => {
        expect(result.revenue.rental).toBe(150);
    });

    test('product revenue is $40 (2 × $20)', () => {
        expect(result.revenue.product).toBe(40);
    });

    test('gross revenue is $190 ($150 + $40)', () => {
        expect(result.revenue.gross).toBe(190);
    });

    /* ── Costs ── */
    test('ad spend from CostStore is $10', () => {
        expect(result.costs.adSpend).toBe(10);
    });

    test('CPA from leads is $70', () => {
        expect(result.costs.cpa).toBe(70);
    });

    test('total marketing cost is $80 (ad spend $10 + CPA $70)', () => {
        expect(result.costs.marketing).toBe(80);
    });

    test('total operational cost is $30', () => {
        expect(result.costs.opCost).toBe(30);
    });

    test('total COGS is $30 (2 × $15)', () => {
        expect(result.costs.cogs).toBe(30);
    });

    test('TOTAL COSTS is exactly $140 ($80 marketing + $30 opCost + $30 COGS)', () => {
        expect(result.costs.total).toBe(140);
    });

    /* ── Profit ── */
    test('NET PROFIT is exactly $50 ($190 - $140)', () => {
        expect(result.profit.net).toBe(50);
    });

    test('profit margin is 26.32% ($50 / $190)', () => {
        expect(result.profit.margin).toBeCloseTo(26.32, 1);
    });

    /* ── KPIs ── */
    test('lead count is 2 (1 rental + 1 product)', () => {
        expect(result.kpis.leads).toBe(2);
    });

    test('avg order value (AOV) is $95 ($190 / 2 leads)', () => {
        expect(result.kpis.aov).toBe(95);
    });

    test('ROI is 35.71% ($50 net / $140 costs)', () => {
        expect(result.kpis.roi).toBeCloseTo(35.71, 1);
    });
});

/* ════════════════════════════════════════════════════════════════
   2. EDGE CASES — zero, negative, empty inputs
════════════════════════════════════════════════════════════════ */

describe('calcPnL — edge cases', () => {

    test('empty leads and costs returns zero revenue and profit', () => {
        const r = calcPnL({ leads: [], costs: [] });
        expect(r.revenue.gross).toBe(0);
        expect(r.costs.total).toBe(0);
        expect(r.profit.net).toBe(0);
        expect(r.profit.margin).toBeNull();
        expect(r.kpis.roi).toBeNull();
        expect(r.kpis.aov).toBeNull();
    });

    test('revenue with no costs: 100% margin, positive ROI returns null (0 costs)', () => {
        const r = calcPnL({
            leads: [{ type: 'rental', date: DATE, revenue: 200, costCPA: 0, opCost: 0, cogs: 0 }],
            costs: [],
        });
        expect(r.revenue.gross).toBe(200);
        expect(r.costs.total).toBe(0);
        expect(r.profit.net).toBe(200);
        expect(r.profit.margin).toBe(100);
        expect(r.kpis.roi).toBeNull(); // undefined when costs = 0 (avoid ÷0)
    });

    test('costs exceeding revenue produce negative net profit', () => {
        const r = calcPnL({
            leads: [{ type: 'rental', date: DATE, revenue: 50, costCPA: 200, opCost: 0, cogs: 0 }],
            costs: [],
        });
        expect(r.profit.net).toBe(-150);
        expect(r.profit.margin).toBeLessThan(0);
    });

    test('missing numeric fields default to 0 without crashing', () => {
        const r = calcPnL({
            leads: [{ type: 'rental', date: DATE, revenue: 100 }], // no costCPA/opCost/cogs
            costs: [],
        });
        expect(r.profit.net).toBe(100);
    });

    test('floating point amounts are rounded to 2 decimal places', () => {
        const r = calcPnL({
            leads: [{ type: 'product', date: DATE, revenue: 33.333, costCPA: 0, opCost: 0, cogs: 11.111 }],
            costs: [],
        });
        expect(r.revenue.gross).toBe(33.33);
        expect(r.costs.cogs).toBe(11.11);
        expect(r.profit.net).toBe(22.22);
    });
});

/* ════════════════════════════════════════════════════════════════
   3. filterByDate — temporal aggregation tests
════════════════════════════════════════════════════════════════ */

describe('filterByDate — date range filtering for Day/Week/Month', () => {

    const items = [
        { id: 1, date: '2026-06-01', amount: 10 }, // start of month
        { id: 2, date: '2026-06-15', amount: 20 }, // mid month
        { id: 3, date: '2026-06-21', amount: 30 }, // today (canonical)
        { id: 4, date: '2026-06-30', amount: 40 }, // end of month
        { id: 5, date: '2026-07-01', amount: 50 }, // next month
        { id: 6, date: '2026-05-31', amount: 60 }, // previous month
    ];

    test('filters to exact single day', () => {
        const r = filterByDate(items, '2026-06-21', '2026-06-21');
        expect(r).toHaveLength(1);
        expect(r[0].id).toBe(3);
    });

    test('filters week range (Jun 15–21)', () => {
        const r = filterByDate(items, '2026-06-15', '2026-06-21');
        expect(r.map(i => i.id)).toEqual([2, 3]);
    });

    test('filters full month of June', () => {
        const r = filterByDate(items, '2026-06-01', '2026-06-30');
        expect(r).toHaveLength(4); // ids 1,2,3,4
        expect(r.every(i => i.date.startsWith('2026-06'))).toBe(true);
    });

    test('excludes previous and next month entries', () => {
        const r = filterByDate(items, '2026-06-01', '2026-06-30');
        const ids = r.map(i => i.id);
        expect(ids).not.toContain(5); // July
        expect(ids).not.toContain(6); // May
    });

    test('returns empty array when no items match the range', () => {
        const r = filterByDate(items, '2025-01-01', '2025-01-31');
        expect(r).toHaveLength(0);
    });

    test('items without a date field are excluded', () => {
        const mixed = [...items, { id: 99, amount: 999 }]; // no date
        const r = filterByDate(mixed, '2026-06-01', '2026-06-30');
        const ids = r.map(i => i.id);
        expect(ids).not.toContain(99);
    });

    test('custom dateKey works for non-standard field names', () => {
        const custom = [
            { id: 'A', createdAt: '2026-06-10', v: 1 },
            { id: 'B', createdAt: '2026-07-01', v: 2 },
        ];
        const r = filterByDate(custom, '2026-06-01', '2026-06-30', 'createdAt');
        expect(r).toHaveLength(1);
        expect(r[0].id).toBe('A');
    });
});

/* ════════════════════════════════════════════════════════════════
   4. getDateRange — period helpers for Today / Week / Month
════════════════════════════════════════════════════════════════ */

describe('getDateRange — period calculation', () => {

    /* Fixed reference: Saturday 2026-06-21 (day 6 in JS, week starts Mon 2026-06-15) */
    const ref = new Date('2026-06-21T12:00:00Z');

    test('"today" returns same from and to', () => {
        const r = getDateRange('today', ref);
        expect(r.from).toBe('2026-06-21');
        expect(r.to).toBe('2026-06-21');
    });

    test('"week" range starts on Monday and ends on Sunday', () => {
        const r = getDateRange('week', ref);
        expect(r.from).toBe('2026-06-15'); // Monday
        expect(r.to).toBe('2026-06-21');   // Sunday
    });

    test('"month" range covers the full month of June 2026', () => {
        const r = getDateRange('month', ref);
        expect(r.from).toBe('2026-06-01');
        expect(r.to).toBe('2026-06-30');
    });

    test('"month" correctly computes last day of February (leap year 2028)', () => {
        const feb = new Date('2028-02-15T12:00:00Z');
        const r   = getDateRange('month', feb);
        expect(r.from).toBe('2028-02-01');
        expect(r.to).toBe('2028-02-29'); // 2028 is a leap year
    });

    test('"month" correctly computes last day of February (non-leap year 2026)', () => {
        const feb = new Date('2026-02-10T12:00:00Z');
        const r   = getDateRange('month', feb);
        expect(r.to).toBe('2026-02-28');
    });

    test('"week" from a Sunday correctly maps to Mon–Sun (prev week)', () => {
        /* Sunday 2026-06-14 → week should be Mon 2026-06-08 – Sun 2026-06-14 */
        const sun = new Date('2026-06-14T12:00:00Z');
        const r   = getDateRange('week', sun);
        expect(r.from).toBe('2026-06-08');
        expect(r.to).toBe('2026-06-14');
    });

    test('unknown period defaults to today', () => {
        const r = getDateRange('quarterly', ref);
        expect(r.from).toBe(r.to); // same day
    });
});

/* ════════════════════════════════════════════════════════════════
   5. COMBINED — filter + calcPnL pipeline (simulating the report engine)
════════════════════════════════════════════════════════════════ */

describe('Combined pipeline: filterByDate → calcPnL', () => {

    /* Dataset spanning 3 weeks */
    const allLeads = [
        // Week 1 (Jun 1-7)
        { type: 'rental',  date: '2026-06-03', revenue: 500, costCPA: 70, opCost: 30, cogs: 0 },
        // Week 2 (Jun 8-14)
        { type: 'rental',  date: '2026-06-10', revenue: 750, costCPA: 70, opCost: 30, cogs: 0 },
        { type: 'product', date: '2026-06-12', revenue:  84, costCPA:  0, opCost:  0, cogs: 36 },
        // Week 3 (Jun 15-21) — canonical scenario
        { type: 'rental',  date: '2026-06-21', revenue: 150, costCPA: 70, opCost: 30, cogs: 0 },
        { type: 'product', date: '2026-06-21', revenue:  40, costCPA:  0, opCost:  0, cogs: 30 },
    ];

    const allCosts = [
        { type: 'adspend', date: '2026-06-03', amount: 25 },
        { type: 'adspend', date: '2026-06-10', amount: 15 },
        { type: 'adspend', date: '2026-06-21', amount: 10 },
    ];

    test('"today" (2026-06-21) shows only canonical scenario: $190 revenue, $140 costs, $50 profit', () => {
        const range         = getDateRange('today', new Date('2026-06-21T12:00:00Z'));
        const filteredLeads = filterByDate(allLeads, range.from, range.to);
        const filteredCosts = filterByDate(allCosts, range.from, range.to);
        const report        = calcPnL({ leads: filteredLeads, costs: filteredCosts });

        expect(report.revenue.gross).toBe(190);
        expect(report.costs.total).toBe(140);
        expect(report.profit.net).toBe(50);
    });

    test('"week" (Jun 15-21) aggregates only current week data', () => {
        const range         = getDateRange('week', new Date('2026-06-21T12:00:00Z'));
        const filteredLeads = filterByDate(allLeads, range.from, range.to);
        const filteredCosts = filterByDate(allCosts, range.from, range.to);
        const report        = calcPnL({ leads: filteredLeads, costs: filteredCosts });

        /* only leads on Jun 15-21 = rental $150 + product $40 */
        expect(report.revenue.gross).toBe(190);
        expect(report.kpis.leads).toBe(2);
    });

    test('"month" (Jun 1-30) aggregates all five entries', () => {
        const range         = getDateRange('month', new Date('2026-06-21T12:00:00Z'));
        const filteredLeads = filterByDate(allLeads, range.from, range.to);
        const filteredCosts = filterByDate(allCosts, range.from, range.to);
        const report        = calcPnL({ leads: filteredLeads, costs: filteredCosts });

        /* all 5 leads */
        expect(report.kpis.leads).toBe(5);
        expect(report.revenue.gross).toBe(500 + 750 + 84 + 150 + 40); // $1524
        expect(report.costs.adSpend).toBe(25 + 15 + 10);              // $50
    });

    test('switching period changes revenue totals without modifying source arrays', () => {
        const dayRange   = getDateRange('today', new Date('2026-06-21T12:00:00Z'));
        const monthRange = getDateRange('month', new Date('2026-06-21T12:00:00Z'));

        const dayReport   = calcPnL({ leads: filterByDate(allLeads, dayRange.from,   dayRange.to),
                                       costs: filterByDate(allCosts, dayRange.from,   dayRange.to) });
        const monthReport = calcPnL({ leads: filterByDate(allLeads, monthRange.from, monthRange.to),
                                       costs: filterByDate(allCosts, monthRange.from, monthRange.to) });

        expect(monthReport.revenue.gross).toBeGreaterThan(dayReport.revenue.gross);
        expect(allLeads).toHaveLength(5); // source array untouched
        expect(allCosts).toHaveLength(3);
    });
});
