/**
 * fin-store.js — BoxRetreat Financial Data Store
 *
 * Manages three financial data types in localStorage:
 *   br_products  → Product catalog with sell price + unit cost
 *   br_costs     → Daily cost entries (property ops, COGS, ad spend)
 *   br_leads     → Converted clients (rental + shop purchases)
 *
 * Also manages role-based admin session:
 *   br_admin_role → 'admin' | null
 */
(function () {
    'use strict';

    /* ═══════════════════════════════════════════════
       KEYS
    ═══════════════════════════════════════════════ */
    const KEYS = {
        products: 'br_products',
        costs:    'br_costs',
        leads:    'br_leads',
        role:     'br_user_role',     // 'admin' | 'client'
        adminPin: 'br_admin_verified', // boolean flag after pin check
    };

    /* ─── Generic storage helpers ─── */
    function load(key)       { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
    function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
    function genId(prefix)   { return prefix + '-' + Date.now().toString(36).toUpperCase(); }

    /* ═══════════════════════════════════════════════
       ROLE GUARD
       ─ Used by admin.html to verify admin access
       ─ Integrates with Auth (Supabase) when available
    ═══════════════════════════════════════════════ */
    window.RoleGuard = {

        ADMIN_EMAIL: 'owner@boxretreat.com', // ← change to your email

        /* Set role after Supabase auth resolves */
        setRole(role) { localStorage.setItem(KEYS.role, role || 'client'); },
        getRole()     { return localStorage.getItem(KEYS.role) || 'client'; },
        isAdmin()     { return this.getRole() === 'admin'; },

        /* Hard-code admin check by email (fallback if Supabase not configured) */
        isAdminEmail(email) {
            return (email || '').toLowerCase() === this.ADMIN_EMAIL.toLowerCase();
        },

        /* Check access — resolves to true/false, never redirects.
           The admin gate HTML handles the unauthorized UI. */
        async requireAdmin() {
            // Try Supabase first
            if (typeof Auth !== 'undefined') {
                try {
                    const user = await Auth.getUser();
                    if (user && this.isAdminEmail(user.email)) {
                        this.setRole('admin');
                        return true;
                    }
                } catch (_) { /* Supabase not configured — fall through */ }
            }

            // Fallback: localStorage role flag (set by gate login form)
            return this.isAdmin();
        },

        /* Called from account.html login form — sets role based on email */
        resolveRoleForEmail(email) {
            const role = this.isAdminEmail(email) ? 'admin' : 'client';
            this.setRole(role);
            return role;
        },

        /* Clear role on sign-out */
        clearRole() { localStorage.removeItem(KEYS.role); },
    };

    /* ═══════════════════════════════════════════════
       PRODUCT CATALOG
       Each product has a sell price AND a unit cost
    ═══════════════════════════════════════════════ */
    window.ProductStore = {

        getAll() { return load(KEYS.products); },

        getById(id) { return this.getAll().find(p => p.id === id) || null; },

        add(product) {
            const all = this.getAll();
            const entry = {
                id:         genId('PROD'),
                name:       product.name,
                category:   product.category    || 'general',
                sellPrice:  Number(product.sellPrice)  || 0,
                costPrice:  Number(product.costPrice)  || 0,
                margin:     Number(product.sellPrice)  - Number(product.costPrice),
                stock:      Number(product.stock)      || 0,
                active:     product.active !== false,
                createdAt:  new Date().toISOString(),
            };
            all.push(entry);
            save(KEYS.products, all);
            return entry;
        },

        update(id, data) {
            const all = this.getAll();
            const i   = all.findIndex(p => p.id === id);
            if (i < 0) return null;
            all[i] = Object.assign({}, all[i], data, {
                margin:    (data.sellPrice ?? all[i].sellPrice) - (data.costPrice ?? all[i].costPrice),
                updatedAt: new Date().toISOString(),
            });
            save(KEYS.products, all);
            return all[i];
        },

        delete(id) { save(KEYS.products, this.getAll().filter(p => p.id !== id)); },

        /* Seed default BoxRetreat products if store is empty */
        seedDefaults() {
            if (this.getAll().length > 0) return;
            const defaults = [
                { name: 'BoxRetreat T-Shirt',   category: 'apparel',  sellPrice: 28, costPrice: 12, stock: 50 },
                { name: 'Surf Wax (3-pack)',     category: 'surf',     sellPrice: 15, costPrice:  5, stock: 30 },
                { name: 'Beach Tote Bag',        category: 'apparel',  sellPrice: 22, costPrice:  8, stock: 20 },
                { name: 'Snorkel Set',           category: 'water',    sellPrice: 45, costPrice: 18, stock: 10 },
                { name: 'BoxRetreat Cap',        category: 'apparel',  sellPrice: 24, costPrice:  9, stock: 25 },
                { name: 'Surfboard (day rental)',category: 'surf',     sellPrice: 35, costPrice:  5, stock:  3 },
            ];
            defaults.forEach(p => this.add(p));
        },
    };

    /* ═══════════════════════════════════════════════
       COST STORE
       Types:
         'property' — daily operational cost of the property
         'product'  — cost of goods sold (COGS) for a product sale
         'adspend'  — paid advertising investment
    ═══════════════════════════════════════════════ */
    window.CostStore = {

        getAll() { return load(KEYS.costs); },

        add(cost) {
            const all = this.getAll();
            const entry = {
                id:           genId('COST'),
                type:         cost.type         || 'property',   // 'property'|'product'|'adspend'
                date:         cost.date         || new Date().toISOString().split('T')[0],
                description:  cost.description  || '',
                amount:       Number(cost.amount) || 0,
                /* product-specific */
                productId:    cost.productId    || null,
                productName:  cost.productName  || null,
                units:        Number(cost.units) || null,
                unitCost:     Number(cost.unitCost) || null,
                /* adspend-specific */
                platform:     cost.platform     || null,
                campaign:     cost.campaign     || null,
                leadsExpected:Number(cost.leadsExpected) || null,
                createdAt:    new Date().toISOString(),
            };
            all.push(entry);
            save(KEYS.costs, all);
            return entry;
        },

        update(id, data) {
            const all = this.getAll();
            const i   = all.findIndex(c => c.id === id);
            if (i < 0) return null;
            all[i] = Object.assign({}, all[i], data, { updatedAt: new Date().toISOString() });
            save(KEYS.costs, all);
            return all[i];
        },

        delete(id) { save(KEYS.costs, this.getAll().filter(c => c.id !== id)); },

        /* ── Range queries ── */
        inRange(from, to) {
            return this.getAll().filter(c => c.date >= from && c.date <= to);
        },

        sumByType(entries, type) {
            return entries.filter(c => c.type === type).reduce((s, c) => s + c.amount, 0);
        },

        /* Daily property op cost (fixed, set by admin) */
        setDailyOpCost(amount) {
            localStorage.setItem('br_daily_op_cost', String(amount));
        },
        getDailyOpCost() {
            return parseFloat(localStorage.getItem('br_daily_op_cost') || '45');
        },
    };

    /* ═══════════════════════════════════════════════
       LEAD STORE
       A Lead = a converted client (completed booking or purchase)
       Tracks revenue, attributed ad cost, and net profit per lead.
    ═══════════════════════════════════════════════ */
    window.LeadStore = {

        getAll() { return load(KEYS.leads); },

        add(lead) {
            const all = this.getAll();
            const revenue = Number(lead.revenue)    || 0;
            const cpa     = Number(lead.costCPA)    || 0;
            const opCost  = Number(lead.opCost)     || 0;
            const cogs    = Number(lead.cogs)        || 0;
            const entry = {
                id:           genId('LEAD'),
                type:         lead.type         || 'rental',   // 'rental' | 'product'
                date:         lead.date         || new Date().toISOString().split('T')[0],
                reservationId:lead.reservationId || lead.orderId || null,
                guestName:    lead.guestName    || '',
                guestEmail:   lead.guestEmail   || '',
                revenue,
                costCPA:      cpa,
                opCost,
                cogs,
                totalCost:    cpa + opCost + cogs,
                netProfit:    revenue - cpa - opCost - cogs,
                source:       lead.source       || 'organic', // 'meta'|'google'|'tiktok'|'organic'|'direct'
                campaign:     lead.campaign     || '',
                createdAt:    new Date().toISOString(),
            };
            all.push(entry);
            save(KEYS.leads, all);
            return entry;
        },

        update(id, data) {
            const all = this.getAll();
            const i   = all.findIndex(l => l.id === id);
            if (i < 0) return null;
            const updated = Object.assign({}, all[i], data);
            // Recompute derived fields
            updated.totalCost  = (updated.costCPA || 0) + (updated.opCost || 0) + (updated.cogs || 0);
            updated.netProfit  = (updated.revenue || 0) - updated.totalCost;
            updated.updatedAt  = new Date().toISOString();
            all[i] = updated;
            save(KEYS.leads, all);
            return all[i];
        },

        delete(id) { save(KEYS.leads, this.getAll().filter(l => l.id !== id)); },

        inRange(from, to) {
            return this.getAll().filter(l => l.date >= from && l.date <= to);
        },

        /* Auto-create a lead from a confirmed reservation */
        fromReservation(reservation, cpa = 0, source = 'direct') {
            const n = reservation;
            const revenue = n.price?.total ?? n.total ?? 0;
            const nights  = n.price?.nights ?? n.nights ?? 1;
            const opCost  = CostStore.getDailyOpCost() * nights;
            return this.add({
                type:          'rental',
                date:          n.checkIn,
                reservationId: n.id,
                guestName:     n.guest?.name  ?? n.name  ?? '',
                guestEmail:    n.guest?.email ?? n.email ?? '',
                revenue,
                costCPA:       cpa,
                opCost,
                cogs:          0,
                source,
            });
        },
    };

    /* ═══════════════════════════════════════════════
       REPORT ENGINE
       Pure calculation functions — no DOM manipulation
    ═══════════════════════════════════════════════ */
    window.FinReport = {

        /* ISO date helpers */
        today()  { return new Date().toISOString().split('T')[0]; },
        addDays(iso, n) {
            const d = new Date(iso + 'T12:00:00');
            d.setDate(d.getDate() + n);
            return d.toISOString().split('T')[0];
        },

        /* ── Build date range for a filter period ── */
        rangeFor(period) {
            const today = this.today();
            switch (period) {
                case 'today':
                    return { from: today, to: today };
                case 'week': {
                    const d = new Date(today + 'T12:00:00');
                    const dow = d.getDay(); // 0=Sun
                    const mon = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
                    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
                    return {
                        from: mon.toISOString().split('T')[0],
                        to:   sun.toISOString().split('T')[0],
                    };
                }
                case 'month': {
                    const [y, m] = today.split('-');
                    const last = new Date(+y, +m, 0).getDate();
                    return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
                }
                case 'custom':
                    return null; // caller provides from/to
                default:
                    return { from: today, to: today };
            }
        },

        /* ── Core metric calculation ── */
        calculate(from, to) {
            const leads = LeadStore.inRange(from, to);
            const costs = CostStore.inRange(from, to);

            /* Revenue */
            const grossRevenue    = leads.reduce((s, l) => s + l.revenue, 0);

            /* Costs from CostStore (manual entries) */
            const adSpend         = CostStore.sumByType(costs, 'adspend');
            const cogsCostStore   = CostStore.sumByType(costs, 'product');
            const propOpCostStore = CostStore.sumByType(costs, 'property');

            /* Costs from LeadStore (auto-computed per lead) */
            const cpaTotal        = leads.reduce((s, l) => s + (l.costCPA  || 0), 0);
            const opCostLeads     = leads.reduce((s, l) => s + (l.opCost   || 0), 0);
            const cogsLeads       = leads.reduce((s, l) => s + (l.cogs     || 0), 0);

            /* Merge: prefer CostStore entries, fall back to lead-computed */
            const totalAdSpend    = adSpend    || cpaTotal;
            const totalOpCost     = propOpCostStore || opCostLeads;
            const totalCOGS       = cogsCostStore   || cogsLeads;
            const totalCosts      = totalAdSpend + totalOpCost + totalCOGS;
            const netProfit       = grossRevenue - totalCosts;
            const roi             = totalCosts > 0 ? ((netProfit / totalCosts) * 100) : null;
            const cpa             = leads.length > 0 ? (totalAdSpend / leads.length) : null;
            const avgOrderValue   = leads.length > 0 ? (grossRevenue / leads.length) : null;
            const convRate        = null; // requires traffic data (future)

            /* By type */
            const rentalLeads  = leads.filter(l => l.type === 'rental');
            const productLeads = leads.filter(l => l.type === 'product');

            return {
                period: { from, to },
                leads:  {
                    total:   leads.length,
                    rental:  rentalLeads.length,
                    product: productLeads.length,
                },
                revenue: {
                    gross:   grossRevenue,
                    rental:  rentalLeads.reduce((s, l)  => s + l.revenue, 0),
                    product: productLeads.reduce((s, l) => s + l.revenue, 0),
                },
                costs: {
                    adSpend:   totalAdSpend,
                    opCost:    totalOpCost,
                    cogs:      totalCOGS,
                    total:     totalCosts,
                    breakdown: {
                        adSpendManual:  adSpend,
                        adSpendLeads:   cpaTotal,
                        opCostManual:   propOpCostStore,
                        opCostLeads:    opCostLeads,
                        cogsManual:     cogsCostStore,
                        cogsLeads:      cogsLeads,
                    },
                },
                profit: {
                    net:    netProfit,
                    margin: grossRevenue > 0 ? ((netProfit / grossRevenue) * 100) : null,
                },
                kpis: { roi, cpa, avgOrderValue, convRate },
                raw:  { leads, costs },
            };
        },

        /* ── Build daily breakdown for chart ── */
        dailyBreakdown(from, to) {
            const leads = LeadStore.inRange(from, to);
            const costs = CostStore.inRange(from, to);

            /* Group by date */
            const byDate = {};
            const addDay = date => {
                if (!byDate[date]) byDate[date] = { date, revenue: 0, costs: 0 };
            };

            leads.forEach(l => { addDay(l.date); byDate[l.date].revenue += l.revenue; });
            costs.forEach(c => { addDay(c.date); byDate[c.date].costs   += c.amount; });

            return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
        },

        /* ── Source breakdown (for attribution) ── */
        bySource(from, to) {
            const leads = LeadStore.inRange(from, to);
            const sources = {};
            leads.forEach(l => {
                const s = l.source || 'organic';
                if (!sources[s]) sources[s] = { count: 0, revenue: 0, cpa: 0 };
                sources[s].count++;
                sources[s].revenue += l.revenue;
                sources[s].cpa     += l.costCPA || 0;
            });
            return sources;
        },
    };

    /* ─── Init product defaults on load ─── */
    document.addEventListener('DOMContentLoaded', () => {
        ProductStore.seedDefaults();
    });

})();
