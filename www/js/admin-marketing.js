/**
 * admin-marketing.js — BoxRetreat Owner Marketing ROI Module
 *
 * Storage keys:
 *   br_ad_spend  → Array<SpendEntry>
 *
 * SpendEntry {
 *   id        : string  (BR-MKT-{timestamp})
 *   period    : string  (YYYY-MM)
 *   platform  : 'meta' | 'google' | 'tiktok' | 'other'
 *   campaign  : string  (optional label)
 *   spend     : number  (USD)
 *   createdAt : string  (ISO date)
 * }
 */
(function () {
    'use strict';

    /* ═══════════════════════════════════════════════
       STORAGE
    ═══════════════════════════════════════════════ */
    const SPEND_KEY = 'br_ad_spend';

    function getSpend() {
        try { return JSON.parse(localStorage.getItem(SPEND_KEY) || '[]'); }
        catch { return []; }
    }
    function saveSpend(arr) {
        localStorage.setItem(SPEND_KEY, JSON.stringify(arr));
    }
    function addSpend(entry) {
        const arr = getSpend();
        arr.unshift(entry);
        saveSpend(arr);
    }
    function deleteSpend(id) {
        saveSpend(getSpend().filter(e => e.id !== id));
    }

    /* ═══════════════════════════════════════════════
       HELPERS
    ═══════════════════════════════════════════════ */
    function fmt(n) {
        return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'; }
    function periodLabel(ym) {
        if (!ym) return '—';
        const [y, m] = ym.split('-');
        return new Date(+y, +m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
    }
    function platformIcon(p) {
        return { meta: '📘', google: '🔍', tiktok: '🎵', other: '📣' }[p] || '📣';
    }
    function toast(msg, type) {
        const el = document.getElementById('admin-toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'admin-toast show ' + (type || 'info');
        setTimeout(() => el.classList.remove('show'), 3000);
    }

    /* ── Revenue from confirmed reservations for a given YYYY-MM ── */
    function revenueForPeriod(period) {
        const reservations = (typeof RentalStore !== 'undefined')
            ? RentalStore.getReservations()
            : [];
        return reservations
            .filter(r => r.status === 'confirmed' && (r.checkIn || '').startsWith(period))
            .reduce((sum, r) => {
                const t = r.price?.total ?? r.total ?? 0;
                return sum + Number(t);
            }, 0);
    }

    /* ── All-time confirmed revenue ── */
    function totalRevenue() {
        const reservations = (typeof RentalStore !== 'undefined')
            ? RentalStore.getReservations()
            : [];
        return reservations
            .filter(r => r.status === 'confirmed')
            .reduce((s, r) => s + Number(r.price?.total ?? r.total ?? 0), 0);
    }

    /* ── All-time confirmed bookings ── */
    function totalBookings() {
        if (typeof RentalStore === 'undefined') return 0;
        return RentalStore.getReservations().filter(r => r.status === 'confirmed').length;
    }

    /* ── ROI = (Revenue - Spend) / Spend × 100 ── */
    function calcROI(revenue, spend) {
        if (!spend) return null;
        return ((revenue - spend) / spend) * 100;
    }

    /* ── CPA = Spend / Bookings ── */
    function calcCPA(spend, bookings) {
        if (!bookings) return null;
        return spend / bookings;
    }

    /* ═══════════════════════════════════════════════
       KPI CARDS RENDER
    ═══════════════════════════════════════════════ */
    function renderKPIs() {
        const spend       = getSpend();
        const totalSpend  = spend.reduce((s, e) => s + e.spend, 0);
        const revenue     = totalRevenue();
        const bookings    = totalBookings();
        const roi         = calcROI(revenue, totalSpend);
        const cpa         = calcCPA(totalSpend, bookings);

        /* Current month */
        const now         = new Date();
        const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthSpend  = spend
            .filter(e => e.period === currentPeriod)
            .reduce((s, e) => s + e.spend, 0);
        const monthRevenue = revenueForPeriod(currentPeriod);

        /* Occupancy (nights booked this month vs. 30 days) */
        const reservations = (typeof RentalStore !== 'undefined')
            ? RentalStore.getReservations()
            : [];
        const nightsBooked = reservations
            .filter(r => r.status === 'confirmed' && (r.checkIn || '').startsWith(currentPeriod))
            .reduce((s, r) => {
                const n = r.price?.nights ?? r.nights ?? 0;
                return s + Number(n);
            }, 0);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const occupancy   = Math.min(100, Math.round((nightsBooked / daysInMonth) * 100));

        /* ── Inject KPI values ── */
        const set = (id, val, cls) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = val;
            if (cls) el.className = 'kpi-value ' + cls;
        };

        set('mkt-kpi-revenue',      fmt(revenue));
        set('mkt-kpi-spend',        fmt(totalSpend));
        set('mkt-kpi-roi',          roi !== null ? fmtPct(roi) : 'N/A',
            roi === null ? '' : roi >= 0 ? 'kpi-value kpi-positive' : 'kpi-value kpi-negative');
        set('mkt-kpi-cpa',          cpa !== null ? fmt(cpa) : 'N/A');
        set('mkt-kpi-bookings',     bookings);
        set('mkt-kpi-month-spend',  fmt(monthSpend));
        set('mkt-kpi-month-rev',    fmt(monthRevenue));
        set('mkt-kpi-occupancy',    occupancy + '%');

        /* Occupancy bar */
        const bar = document.getElementById('mkt-occupancy-bar');
        if (bar) bar.style.width = occupancy + '%';

        /* ROI result rows */
        const setRoi = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };
        setRoi('roi-total-revenue', fmt(revenue));
        setRoi('roi-total-spend',   fmt(totalSpend));
        setRoi('roi-profit',        fmt(revenue - totalSpend));
        setRoi('roi-roi',           roi !== null ? fmtPct(roi) : 'N/A');
        setRoi('roi-cpa',           cpa !== null ? fmt(cpa) : 'N/A');
        if (roi !== null) {
            const roiEl = document.getElementById('roi-roi');
            if (roiEl) roiEl.style.color = roi >= 0 ? '#16a34a' : '#dc2626';
        }
    }

    /* ═══════════════════════════════════════════════
       BAR CHART (Revenue vs Spend — last 6 months)
    ═══════════════════════════════════════════════ */
    function renderChart() {
        const container = document.getElementById('mkt-bar-chart');
        if (!container) return;

        const spend = getSpend();
        const now   = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push({ ym, label: d.toLocaleString('en-US', { month: 'short' }) });
        }

        const data = months.map(({ ym, label }) => ({
            label,
            revenue: revenueForPeriod(ym),
            spend:   spend.filter(e => e.period === ym).reduce((s, e) => s + e.spend, 0),
        }));

        const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.spend]), 1);

        container.innerHTML = data.map(d => {
            const rPct = Math.round((d.revenue / maxVal) * 100);
            const sPct = Math.round((d.spend   / maxVal) * 100);
            return `
                <div class="mkt-bar-row">
                    <span class="mkt-bar-label">${d.label}</span>
                    <div style="flex:1;display:flex;flex-direction:column;gap:3px;">
                        <div class="mkt-bar-track">
                            <div class="mkt-bar-fill revenue-bar" style="width:${rPct}%"></div>
                        </div>
                        <div class="mkt-bar-track">
                            <div class="mkt-bar-fill spend-bar" style="width:${sPct}%"></div>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;width:64px;text-align:right;">
                        <span class="mkt-bar-num" style="font-size:11px;color:#00B4D8;">${d.revenue ? fmt(d.revenue) : '—'}</span>
                        <span class="mkt-bar-num" style="font-size:11px;color:#f59e0b;">${d.spend   ? fmt(d.spend)   : '—'}</span>
                    </div>
                </div>`;
        }).join('');
    }

    /* ═══════════════════════════════════════════════
       HISTORY TABLE
    ═══════════════════════════════════════════════ */
    function renderHistory() {
        const tbody = document.getElementById('mkt-history-body');
        const empty = document.getElementById('mkt-history-empty');
        if (!tbody) return;

        const entries = getSpend();

        if (entries.length === 0) {
            tbody.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        tbody.innerHTML = entries.map(e => {
            const rev     = revenueForPeriod(e.period);
            const roi     = calcROI(rev, e.spend);
            const roiBadge = roi === null
                ? '<span style="color:#717171;font-size:12px;">N/A</span>'
                : roi >= 0
                    ? `<span class="badge-roi-pos">${fmtPct(roi)}</span>`
                    : `<span class="badge-roi-neg">${fmtPct(roi)}</span>`;

            return `<tr>
                <td>${periodLabel(e.period)}</td>
                <td>${platformIcon(e.platform)} ${e.platform.charAt(0).toUpperCase() + e.platform.slice(1)}</td>
                <td>${e.campaign || '—'}</td>
                <td>${fmt(e.spend)}</td>
                <td>${rev ? fmt(rev) : '<span style="color:#717171">No data</span>'}</td>
                <td>${roiBadge}</td>
                <td>
                    <button class="btn-delete-spend" data-id="${e.id}" title="Delete">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-delete-spend').forEach(btn => {
            btn.addEventListener('click', () => {
                deleteSpend(btn.dataset.id);
                refresh();
                toast('Entry deleted', 'error');
            });
        });
    }

    /* ═══════════════════════════════════════════════
       FORM — Save Ad Spend Entry
    ═══════════════════════════════════════════════ */
    function initForm() {
        const form = document.getElementById('mkt-spend-form');
        if (!form) return;

        /* Set default period to current month */
        const periodInput = document.getElementById('mkt-period');
        if (periodInput && !periodInput.value) {
            const now = new Date();
            periodInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const period   = document.getElementById('mkt-period')?.value || '';
            const platform = document.getElementById('mkt-platform')?.value || 'meta';
            const campaign = document.getElementById('mkt-campaign')?.value.trim() || '';
            const spendVal = parseFloat(document.getElementById('mkt-spend-amount')?.value || '0');

            if (!period) { toast('Select a period', 'error'); return; }
            if (!spendVal || spendVal <= 0) { toast('Enter a valid spend amount', 'error'); return; }

            const entry = {
                id:        'BR-MKT-' + Date.now(),
                period,
                platform,
                campaign,
                spend:     spendVal,
                createdAt: new Date().toISOString(),
            };

            addSpend(entry);
            form.reset();

            /* Re-set default period */
            if (periodInput) {
                const now = new Date();
                periodInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }

            refresh();
            toast('Ad spend saved ✓', 'success');
        });
    }

    /* ═══════════════════════════════════════════════
       MASTER REFRESH
    ═══════════════════════════════════════════════ */
    function refresh() {
        renderKPIs();
        renderChart();
        renderHistory();
    }

    /* ═══════════════════════════════════════════════
       INIT
    ═══════════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', function () {
        initForm();
        refresh();
    });

    /* Expose for external calls (e.g., when reservations change) */
    window.MarketingDash = { refresh };

})();
