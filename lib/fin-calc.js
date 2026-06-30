/**
 * lib/fin-calc.js — Pure financial calculation engine.
 *
 * No DOM, no localStorage, no side effects.
 * Used by: tests/ (Jest), server.js, and fin-store.js (browser).
 *
 * Cost model:
 *   - adSpend   → daily platform budget (from CostStore, type='adspend')
 *   - costCPA   → per-lead acquisition cost (from LeadStore, attributed separately)
 *   - opCost    → property operational cost (from LeadStore OR CostStore type='property')
 *   - cogs      → cost of goods sold (from LeadStore OR CostStore type='product')
 *
 * adSpend and costCPA are ADDITIVE — they represent different cost categories,
 * not the same spend viewed from different angles.
 */

'use strict';

/**
 * Calculate a full P&L from arrays of leads and cost entries.
 *
 * @param {object} params
 * @param {Array}  params.leads  — LeadStore items in the period
 * @param {Array}  params.costs  — CostStore items in the period
 * @returns {object} Full P&L breakdown
 */
function calcPnL({ leads = [], costs = [] }) {
    /* ── Revenue ── */
    const rentalRevenue  = leads.filter(l => l.type === 'rental')
                                .reduce((s, l) => s + (Number(l.revenue)  || 0), 0);
    const productRevenue = leads.filter(l => l.type === 'product')
                                .reduce((s, l) => s + (Number(l.revenue)  || 0), 0);
    const grossRevenue   = rentalRevenue + productRevenue;

    /* ── Costs from CostStore entries ── */
    const adSpendEntries  = costs.filter(c => c.type === 'adspend');
    const propCostEntries = costs.filter(c => c.type === 'property');
    const prodCostEntries = costs.filter(c => c.type === 'product');

    const adSpendStore  = adSpendEntries .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const opCostStore   = propCostEntries.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const cogsStore     = prodCostEntries.reduce((s, c) => s + (Number(c.amount) || 0), 0);

    /* ── Costs from Lead attribution ── */
    const cpaTotal    = leads.reduce((s, l) => s + (Number(l.costCPA) || 0), 0);
    const opCostLeads = leads.reduce((s, l) => s + (Number(l.opCost)  || 0), 0);
    const cogsLeads   = leads.reduce((s, l) => s + (Number(l.cogs)    || 0), 0);

    /* ── Aggregates (additive — separate cost categories) ── */
    const totalAdMarketing = adSpendStore + cpaTotal;  // platform budget + per-lead CPA
    const totalOpCost      = opCostStore  + opCostLeads;
    const totalCOGS        = cogsStore    + cogsLeads;
    const totalCosts       = totalAdMarketing + totalOpCost + totalCOGS;
    const netProfit        = grossRevenue - totalCosts;
    const marginPct        = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : null;
    const roiPct           = totalCosts   > 0 ? (netProfit / totalCosts)   * 100 : null;
    const avgCPA           = leads.length > 0 ? adSpendStore / leads.length      : null;
    const aov              = leads.length > 0 ? grossRevenue / leads.length       : null;

    return {
        revenue: {
            rental:  round2(rentalRevenue),
            product: round2(productRevenue),
            gross:   round2(grossRevenue),
        },
        costs: {
            adSpend: round2(adSpendStore),
            cpa:     round2(cpaTotal),
            marketing: round2(totalAdMarketing),
            opCost:  round2(totalOpCost),
            cogs:    round2(totalCOGS),
            total:   round2(totalCosts),
        },
        profit: {
            net:    round2(netProfit),
            margin: marginPct !== null ? round2(marginPct) : null,
        },
        kpis: {
            roi:   roiPct !== null ? round2(roiPct) : null,
            cpa:   avgCPA !== null ? round2(avgCPA) : null,
            aov:   aov    !== null ? round2(aov)    : null,
            leads: leads.length,
        },
    };
}

/**
 * Filter an array of items to only those whose date falls within [from, to].
 * The dateKey defaults to 'date'; items without that field are excluded.
 *
 * @param {Array}  items
 * @param {string} from      — 'YYYY-MM-DD'
 * @param {string} to        — 'YYYY-MM-DD'
 * @param {string} [dateKey] — default 'date'
 */
function filterByDate(items, from, to, dateKey = 'date') {
    if (!from || !to) return items;
    return items.filter(item => {
        const d = (item[dateKey] || '').slice(0, 10);
        return d >= from && d <= to;
    });
}

/**
 * Return { from, to } date strings for a named period.
 *
 * @param {'today'|'week'|'month'} period
 * @param {Date} [referenceDate] — defaults to today (for testing determinism)
 */
function getDateRange(period, referenceDate = new Date()) {
    const iso   = referenceDate.toISOString().split('T')[0];
    const [y, m] = iso.split('-').map(Number);

    switch (period) {
        case 'today':
            return { from: iso, to: iso };

        case 'week': {
            const d   = new Date(referenceDate);
            const dow = d.getDay(); // 0=Sun…6=Sat
            const mon = new Date(d);
            mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);                       // Sunday
            return {
                from: mon.toISOString().split('T')[0],
                to:   sun.toISOString().split('T')[0],
            };
        }

        case 'month': {
            const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last day
            return {
                from: `${y}-${pad(m)}-01`,
                to:   `${y}-${pad(m)}-${lastDay}`,
            };
        }

        default:
            return { from: iso, to: iso };
    }
}

/* ── helpers ── */
function round2(n) { return Math.round(n * 100) / 100; }
function pad(n)    { return String(n).padStart(2, '0'); }

module.exports = { calcPnL, filterByDate, getDateRange };
