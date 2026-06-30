/**
 * admin-reports.js — BoxRetreat Financial Reports + Costs CRUD UI
 *
 * Requires: fin-store.js (FinReport, CostStore, LeadStore, ProductStore)
 * Handles three admin tabs:
 *   #tab-costs    — Product catalog + daily cost CRUD
 *   #tab-leads    — Lead registration and table
 *   #tab-reports  — P&L report with Day/Week/Month filters
 */
(function () {
    'use strict';

    /* ── Formatting helpers ── */
    const $ = id => document.getElementById(id);
    const fmt    = n  => '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const fmtPct = n  => (n >= 0 ? '+' : '') + Number(n).toFixed(1) + '%';
    const fmtN   = n  => (n || 0).toLocaleString('en-US');

    function toast(msg, type) {
        const el = $('admin-toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'admin-toast show ' + (type || 'info');
        setTimeout(() => el.classList.remove('show'), 3200);
    }

    /* ══════════════════════════════════════════════════════════
       SECTION 1 · COSTS TAB
       — Daily op cost setting
       — Cost entries CRUD (property / product / adspend)
       — Product catalog CRUD
    ══════════════════════════════════════════════════════════ */

    /* ── Op Cost Card ── */
    function initOpCost() {
        const input = $('opcost-input');
        if (!input) return;
        input.value = CostStore.getDailyOpCost();
        $('btn-save-opcost').addEventListener('click', () => {
            const v = parseFloat(input.value);
            if (isNaN(v) || v < 0) { toast('Enter a valid amount', 'error'); return; }
            CostStore.setDailyOpCost(v);
            toast('Daily op cost saved ✓', 'success');
        });
    }

    /* ── Cost entries table ── */
    function renderCostTable() {
        const tbody = $('costs-body');
        const empty = $('costs-empty');
        if (!tbody) return;

        const entries = CostStore.getAll().sort((a, b) => b.date.localeCompare(a.date));

        if (!entries.length) {
            tbody.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        const badges = {
            property: '<span class="badge-cost-property">Property</span>',
            product:  '<span class="badge-cost-product">Product</span>',
            adspend:  '<span class="badge-cost-adspend">Ad Spend</span>',
        };

        tbody.innerHTML = entries.map(c => `
            <tr>
                <td>${c.date}</td>
                <td>${badges[c.type] || c.type}</td>
                <td>${c.description || (c.productName ? c.productName + ' ×' + c.units : '—')}</td>
                <td>${c.platform ? '📣 ' + c.platform : '—'}</td>
                <td><strong>${fmt(c.amount)}</strong></td>
                <td>
                    <button class="btn-del-cost" data-id="${c.id}" title="Delete">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-del-cost').forEach(btn => {
            btn.addEventListener('click', () => {
                CostStore.delete(btn.dataset.id);
                renderCostTable();
                toast('Cost entry removed', 'error');
            });
        });
    }

    /* ── Cost entry form ── */
    function initCostForm() {
        const form = $('cost-entry-form');
        if (!form) return;

        /* Default date to today */
        const dateInput = $('cost-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = FinReport.today();
        }

        form.addEventListener('submit', e => {
            e.preventDefault();
            const type   = $('cost-type').value;
            const date   = $('cost-date').value;
            const desc   = $('cost-desc').value.trim();
            const amount = parseFloat($('cost-amount').value);
            const plat   = $('cost-platform')?.value || null;

            if (!date)              { toast('Select a date', 'error'); return; }
            if (!amount || amount <= 0) { toast('Enter a valid amount', 'error'); return; }

            CostStore.add({ type, date, description: desc, amount, platform: plat });
            form.reset();
            if (dateInput) dateInput.value = FinReport.today();
            renderCostTable();
            toast('Cost entry saved ✓', 'success');
        });

        /* Show/hide platform field based on type */
        $('cost-type').addEventListener('change', function () {
            const platformRow = $('cost-platform-row');
            if (platformRow) {
                platformRow.style.display = this.value === 'adspend' ? '' : 'none';
            }
        });
    }

    /* ── Product catalog ── */
    function renderProducts() {
        const grid = $('product-grid');
        if (!grid) return;
        const products = ProductStore.getAll();

        if (!products.length) {
            grid.innerHTML = '<p style="color:#717171;font-size:14px;">No products yet.</p>';
            return;
        }

        grid.innerHTML = products.map(p => `
            <div class="product-card">
                <div class="product-card-name">${p.name}</div>
                <div class="product-card-cat">${p.category}</div>
                <div class="product-card-prices">
                    <span class="pc-sell">${fmt(p.sellPrice)} sell</span>
                    <span class="pc-cost">${fmt(p.costPrice)} cost</span>
                </div>
                <div style="margin-bottom:10px;">
                    <span class="pc-margin">+${fmt(p.margin)} margin (${p.sellPrice > 0 ? Math.round((p.margin/p.sellPrice)*100) : 0}%)</span>
                </div>
                <div class="product-card-actions">
                    <button class="btn-edit-product" data-id="${p.id}">
                        <i class="fa fa-pencil"></i> Edit
                    </button>
                    <button class="btn-del-product" data-id="${p.id}">
                        <i class="fa fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        grid.querySelectorAll('.btn-del-product').forEach(btn => {
            btn.addEventListener('click', () => {
                ProductStore.delete(btn.dataset.id);
                renderProducts();
                toast('Product removed', 'error');
            });
        });

        grid.querySelectorAll('.btn-edit-product').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = ProductStore.getById(btn.dataset.id);
                if (!p) return;
                $('paf-name').value      = p.name;
                $('paf-category').value  = p.category;
                $('paf-sell').value      = p.sellPrice;
                $('paf-cost').value      = p.costPrice;
                $('paf-stock').value     = p.stock || 0;
                $('paf-form').dataset.editId = p.id;
                $('btn-add-product').textContent = 'Update';
                $('paf-name').focus();
            });
        });
    }

    function initProductForm() {
        const form = $('paf-form');
        if (!form) return;

        form.addEventListener('submit', e => {
            e.preventDefault();
            const name      = $('paf-name').value.trim();
            const category  = $('paf-category').value.trim() || 'general';
            const sellPrice = parseFloat($('paf-sell').value);
            const costPrice = parseFloat($('paf-cost').value);
            const stock     = parseInt($('paf-stock').value || '0');
            const editId    = form.dataset.editId || null;

            if (!name)                    { toast('Product name required', 'error'); return; }
            if (isNaN(sellPrice))         { toast('Enter a sell price', 'error'); return; }
            if (isNaN(costPrice))         { toast('Enter a cost price', 'error'); return; }
            if (sellPrice < costPrice)    { toast('Sell price should be ≥ cost price', 'info'); }

            if (editId) {
                ProductStore.update(editId, { name, category, sellPrice, costPrice, stock });
                delete form.dataset.editId;
                $('btn-add-product').textContent = '+ Add Product';
                toast('Product updated ✓', 'success');
            } else {
                ProductStore.add({ name, category, sellPrice, costPrice, stock });
                toast('Product added ✓', 'success');
            }

            form.reset();
            renderProducts();
        });
    }

    /* ══════════════════════════════════════════════════════════
       SECTION 2 · LEADS TAB
       — Manual lead entry form
       — Lead table with P&L per lead
    ══════════════════════════════════════════════════════════ */

    function renderLeadTable() {
        const tbody = $('leads-tbody');
        const empty = $('leads-empty');
        if (!tbody) return;

        const leads = LeadStore.getAll().sort((a, b) => b.date.localeCompare(a.date));

        if (!leads.length) {
            tbody.innerHTML = '';
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        const sourceIcon = { meta:'📘', google:'🔍', tiktok:'🎵', organic:'🌱', direct:'🔗' };

        tbody.innerHTML = leads.map(l => {
            const profitClass = l.netProfit >= 0 ? 'profit-pos' : 'profit-neg';
            return `<tr>
                <td>${l.date}</td>
                <td>${l.type === 'rental'
                    ? '<span class="badge-type-rental">Rental</span>'
                    : '<span class="badge-type-product">Product</span>'}
                </td>
                <td>
                    <strong>${l.guestName || '—'}</strong>
                    <br/><span style="font-size:11px;color:#aaa;">${l.guestEmail || ''}</span>
                </td>
                <td>${sourceIcon[l.source] || '—'} ${l.source || '—'}</td>
                <td><strong>${fmt(l.revenue)}</strong></td>
                <td style="color:#f59e0b;">${fmt(l.costCPA)}</td>
                <td style="color:#717171;">${fmt(l.opCost)}</td>
                <td style="color:#717171;">${fmt(l.cogs)}</td>
                <td class="${profitClass}">${fmt(l.netProfit)}</td>
                <td>
                    <button class="btn-delete-lead" data-id="${l.id}" title="Delete">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-delete-lead').forEach(btn => {
            btn.addEventListener('click', () => {
                LeadStore.delete(btn.dataset.id);
                renderLeadTable();
                refreshReports();
                toast('Lead removed', 'error');
            });
        });
    }

    function initLeadForm() {
        const form = $('lead-form');
        if (!form) return;

        const dateInput = $('lead-date');
        if (dateInput && !dateInput.value) dateInput.value = FinReport.today();

        /* Auto-fill from reservation selector */
        const resSel = $('lead-reservation-id');
        if (resSel) {
            const reservations = (typeof RentalStore !== 'undefined')
                ? RentalStore.getReservations().filter(r => r.status === 'confirmed')
                : [];
            resSel.innerHTML = '<option value="">— None / manual entry —</option>'
                + reservations.map(r => {
                    const name  = r.guest?.name  ?? r.name  ?? 'Unknown';
                    const total = r.price?.total  ?? r.total ?? 0;
                    return `<option value="${r.id}" data-checkin="${r.checkIn}" data-name="${name}" data-email="${r.guest?.email ?? r.email ?? ''}" data-rev="${total}">${r.id} · ${name} · ${r.checkIn} · ${fmt(total)}</option>`;
                }).join('');

            resSel.addEventListener('change', function () {
                const opt = this.options[this.selectedIndex];
                if (!opt.value) return;
                $('lead-date').value     = opt.dataset.checkin || FinReport.today();
                $('lead-name').value     = opt.dataset.name    || '';
                $('lead-email').value    = opt.dataset.email   || '';
                $('lead-revenue').value  = opt.dataset.rev     || '';
                $('lead-opcost').value   = (CostStore.getDailyOpCost() * 1).toFixed(0);
                $('lead-type').value     = 'rental';
            });
        }

        form.addEventListener('submit', e => {
            e.preventDefault();
            const revenue  = parseFloat($('lead-revenue').value);
            const cpa      = parseFloat($('lead-cpa').value   || '0');
            const opCost   = parseFloat($('lead-opcost').value || '0');
            const cogs     = parseFloat($('lead-cogs').value  || '0');

            if (!$('lead-date').value)   { toast('Date required', 'error'); return; }
            if (isNaN(revenue) || revenue <= 0) { toast('Enter a valid revenue', 'error'); return; }

            LeadStore.add({
                type:          $('lead-type').value,
                date:          $('lead-date').value,
                reservationId: $('lead-reservation-id')?.value || null,
                guestName:     $('lead-name').value.trim(),
                guestEmail:    $('lead-email').value.trim(),
                revenue,
                costCPA:       cpa,
                opCost,
                cogs,
                source:        $('lead-source').value,
                campaign:      $('lead-campaign')?.value.trim() || '',
            });

            form.reset();
            if (dateInput) dateInput.value = FinReport.today();
            renderLeadTable();
            refreshReports();
            toast('Lead registered ✓', 'success');
        });
    }

    /* ══════════════════════════════════════════════════════════
       SECTION 3 · REPORTS TAB
       — Period filter buttons (Today / Week / Month / Custom)
       — P&L summary cards
       — Bar chart (Revenue vs Costs)
       — Source breakdown
    ══════════════════════════════════════════════════════════ */

    let activePeriod = 'month';
    let customFrom   = null;
    let customTo     = null;

    function getRange() {
        if (activePeriod === 'custom' && customFrom && customTo) {
            return { from: customFrom, to: customTo };
        }
        return FinReport.rangeFor(activePeriod);
    }

    function renderReport() {
        const { from, to } = getRange();
        const report = FinReport.calculate(from, to);

        /* ── KPI Cards ── */
        const setKPI = (id, val, cls) => {
            const el = $(id); if (!el) return;
            el.textContent  = val;
            if (cls) el.className = 'fin-kpi-value ' + cls;
        };

        const profitClass = report.profit.net >= 0 ? 'positive' : 'negative';
        const roiClass    = !report.kpis.roi ? '' : report.kpis.roi >= 0 ? 'positive' : 'negative';

        setKPI('rep-revenue',   fmt(report.revenue.gross));
        setKPI('rep-costs',     fmt(report.costs.total));
        setKPI('rep-profit',    fmt(report.profit.net),  profitClass);
        setKPI('rep-margin',    report.profit.margin !== null ? fmtPct(report.profit.margin) : 'N/A', profitClass);
        setKPI('rep-roi',       report.kpis.roi  !== null ? fmtPct(report.kpis.roi)  : 'N/A', roiClass);
        setKPI('rep-cpa',       report.kpis.cpa  !== null ? fmt(report.kpis.cpa)     : 'N/A');
        setKPI('rep-leads',     fmtN(report.leads.total));
        setKPI('rep-aov',       report.kpis.avgOrderValue !== null ? fmt(report.kpis.avgOrderValue) : 'N/A');

        /* ── P&L Table ── */
        renderPnL(report);

        /* ── Bar Chart ── */
        renderFinChart(from, to);

        /* ── Source Breakdown ── */
        renderSourceBreakdown(from, to);

        /* ── Period label ── */
        const periodLabel = $('rep-period-label');
        if (periodLabel) periodLabel.textContent = `${from} → ${to}`;
    }

    /* ── P&L Breakdown ── */
    function renderPnL(report) {
        const container = $('pnl-body');
        if (!container) return;

        const r  = report.revenue;
        const c  = report.costs;
        const p  = report.profit;
        const profitClass = p.net >= 0 ? 'positive' : 'negative';

        container.innerHTML = `
            <div class="pnl-row section-head">
                <span class="pnl-label">REVENUE</span>
                <span class="pnl-value">${fmt(r.gross)}</span>
            </div>
            <div class="pnl-row indent">
                <span class="pnl-label">Rental bookings</span>
                <span class="pnl-value">${fmt(r.rental)}</span>
            </div>
            <div class="pnl-row indent">
                <span class="pnl-label">Product / shop sales</span>
                <span class="pnl-value">${fmt(r.product)}</span>
            </div>

            <div class="pnl-row section-head" style="margin-top:8px;">
                <span class="pnl-label">COSTS</span>
                <span class="pnl-value" style="color:#f59e0b;">${fmt(c.total)}</span>
            </div>
            <div class="pnl-row indent">
                <span class="pnl-label">Property operational cost</span>
                <span class="pnl-value">${fmt(c.opCost)}</span>
            </div>
            <div class="pnl-row indent">
                <span class="pnl-label">Cost of goods sold (COGS)</span>
                <span class="pnl-value">${fmt(c.cogs)}</span>
            </div>
            <div class="pnl-row indent pnl-subtotal">
                <span class="pnl-label">Ad spend / marketing</span>
                <span class="pnl-value">${fmt(c.adSpend)}</span>
            </div>

            <div class="pnl-row total-row divider">
                <span class="pnl-label">NET PROFIT</span>
                <span class="pnl-value ${profitClass}">${fmt(p.net)}</span>
            </div>
            <div class="pnl-row indent">
                <span class="pnl-label">Profit margin</span>
                <span class="pnl-value">${p.margin !== null ? fmtPct(p.margin) : 'N/A'}</span>
            </div>
        `;
    }

    /* ── Revenue vs Cost Bar Chart ── */
    function renderFinChart(from, to) {
        const container = $('fin-chart');
        if (!container) return;

        const days = FinReport.dailyBreakdown(from, to);

        if (!days.length) {
            container.innerHTML = '<p class="leads-empty">No data for this period.</p>';
            return;
        }

        const maxVal = Math.max(...days.flatMap(d => [d.revenue, d.costs]), 1);

        container.innerHTML = days.map(d => {
            const rPct = Math.round((d.revenue / maxVal) * 100);
            const cPct = Math.round((d.costs   / maxVal) * 100);
            const profit = d.revenue - d.costs;
            const pPct = Math.round((Math.abs(profit) / maxVal) * 100);
            const label = d.date.slice(5); // MM-DD

            return `
                <div class="fin-chart-row">
                    <span class="fin-chart-label">${label}</span>
                    <div class="fin-chart-bars">
                        <div class="fin-chart-track"><div class="fin-chart-fill fill-revenue" style="width:${rPct}%"></div></div>
                        <div class="fin-chart-track"><div class="fin-chart-fill fill-cost"    style="width:${cPct}%"></div></div>
                        <div class="fin-chart-track"><div class="fin-chart-fill fill-profit ${profit<0?'negative':''}" style="width:${pPct}%"></div></div>
                    </div>
                    <div class="fin-chart-vals">
                        <span class="fin-chart-val" style="color:#00B4D8;">${d.revenue ? fmt(d.revenue) : '—'}</span>
                        <span class="fin-chart-val" style="color:#f59e0b;">${d.costs   ? fmt(d.costs)   : '—'}</span>
                        <span class="fin-chart-val" style="color:${profit>=0?'#16a34a':'#dc2626'};">${fmt(profit)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /* ── Source Breakdown ── */
    function renderSourceBreakdown(from, to) {
        const container = $('source-breakdown');
        if (!container) return;

        const sources = FinReport.bySource(from, to);
        const entries = Object.entries(sources);

        const icons = { meta:'📘', google:'🔍', tiktok:'🎵', organic:'🌱', direct:'🔗' };

        if (!entries.length) {
            container.innerHTML = '<p class="leads-empty">No lead data for this period.</p>';
            return;
        }

        container.innerHTML = entries
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .map(([src, d]) => `
                <div class="source-row">
                    <span class="source-icon">${icons[src] || '📣'}</span>
                    <span class="source-name">${src.charAt(0).toUpperCase() + src.slice(1)}</span>
                    <span class="source-stat" style="color:#0A0A0A;">${fmtN(d.count)} leads</span>
                    <span class="source-stat" style="color:#00B4D8;">${fmt(d.revenue)}</span>
                    <span class="source-stat" style="color:#f59e0b;">CPA: ${d.count > 0 ? fmt(d.cpa/d.count) : '—'}</span>
                </div>
            `).join('');
    }

    /* ── Period Filter buttons ── */
    function initPeriodFilter() {
        const buttons = document.querySelectorAll('.period-btn[data-period]');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                activePeriod = btn.dataset.period;
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const customRow = $('custom-range-row');
                if (customRow) customRow.style.display = activePeriod === 'custom' ? '' : 'none';

                if (activePeriod !== 'custom') renderReport();
            });
        });

        const applyBtn = $('btn-apply-range');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                customFrom = $('custom-from')?.value || null;
                customTo   = $('custom-to')?.value   || null;
                if (!customFrom || !customTo) { toast('Select both dates', 'error'); return; }
                if (customFrom > customTo) { toast('Start must be before end', 'error'); return; }
                activePeriod = 'custom';
                renderReport();
            });
        }
    }

    /* ══════════════════════════════════════════════════════════
       ROLE GUARD — Admin Login Gate
       Shown if admin not authenticated; hides admin content
    ══════════════════════════════════════════════════════════ */
    async function initRoleGuard() {
        const gate    = $('admin-gate');
        const content = $('admin-wrap');

        if (!gate) return; // gate not in page

        /* Check admin status */
        const authorized = await RoleGuard.requireAdmin().catch(() => false);

        document.body.classList.remove('hidden');

        if (authorized) {
            gate.style.display    = 'none';
            if (content) content.style.display = '';
            return;
        }

        /* Show login gate, hide content */
        gate.style.display = 'flex';
        if (content) content.style.display = 'none';

        /* Gate form submit */
        const gateForm = $('admin-gate-form');
        if (!gateForm) return;

        gateForm.addEventListener('submit', async e => {
            e.preventDefault();
            const email = $('gate-email').value.trim();
            const pass  = $('gate-password').value;
            const errEl = $('gate-error');

            try {
                if (typeof Auth !== 'undefined') {
                    await Auth.signIn(email, pass);
                }
                const role = RoleGuard.resolveRoleForEmail(email);
                if (role !== 'admin') {
                    if (errEl) { errEl.textContent = 'Access denied — clients use the Account page.'; errEl.classList.add('visible'); }
                    return;
                }
                gate.style.display = 'none';
                if (content) content.style.display = '';
                initAll();
            } catch (err) {
                if (errEl) { errEl.textContent = 'Invalid credentials. Try again.'; errEl.classList.add('visible'); }
            }
        });
    }

    /* ══════════════════════════════════════════════════════════
       MASTER INIT
    ══════════════════════════════════════════════════════════ */
    function initAll() {
        /* Costs tab */
        initOpCost();
        initCostForm();
        renderCostTable();
        renderProducts();
        initProductForm();

        /* Leads tab */
        initLeadForm();
        renderLeadTable();

        /* Reports tab */
        initPeriodFilter();
        renderReport();
    }

    function refreshReports() { renderReport(); }

    document.addEventListener('DOMContentLoaded', async () => {
        await initRoleGuard();

        /* If already authorized (gate resolved inline), init */
        if (RoleGuard.isAdmin()) initAll();
    });

    /* Expose for external refresh calls */
    window.AdminReports = { refresh: refreshReports, renderLeadTable };

})();
