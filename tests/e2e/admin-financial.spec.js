/**
 * admin-financial.spec.js — Playwright E2E: Admin Financial Management Flows
 * ─────────────────────────────────────────────────────────────────────────
 * Full end-to-end flows for the admin dashboard:
 *
 *   1. Product price editing — change T-shirt from $28 to $25, verify UI + storage.
 *   2. Cost log — add an ad spend entry, verify it appears in the history table.
 *   3. Lead registration — fill form, submit, verify it appears in the leads table.
 *   4. P&L report filter — switch between Today / Week / Month and verify KPIs change.
 *
 * Run:  npx playwright test tests/e2e/admin-financial.spec.js --headed --project=chromium
 */

// @ts-check
const { test, expect } = require('@playwright/test');

/* ════════════════════════════════════════════════════════════════
   SETUP — log in as admin, seed products, navigate to admin panel
════════════════════════════════════════════════════════════════ */

const DEFAULT_PRODUCTS = [
    { id: 'PROD-SHIRT',   name: 'BoxRetreat T-Shirt',    category: 'apparel', sellPrice: 28, costPrice: 12, stock: 50 },
    { id: 'PROD-WAX',     name: 'Surf Wax (3-pack)',      category: 'surf',    sellPrice: 15, costPrice:  5, stock: 30 },
    { id: 'PROD-TOTE',    name: 'Beach Tote Bag',         category: 'apparel', sellPrice: 22, costPrice:  8, stock: 20 },
    { id: 'PROD-SNORKEL', name: 'Snorkel Set',            category: 'water',   sellPrice: 45, costPrice: 18, stock: 10 },
    { id: 'PROD-CAP',     name: 'BoxRetreat Cap',         category: 'apparel', sellPrice: 24, costPrice:  9, stock: 25 },
    { id: 'PROD-BOARD',   name: 'Surfboard (day rental)', category: 'surf',    sellPrice: 35, costPrice:  5, stock:  3 },
];

async function loginAsAdmin(page) {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((products) => {
        localStorage.setItem('br_user_role', 'admin');
        // Always reset products to a known state
        localStorage.setItem('br_products', JSON.stringify(products));
    }, DEFAULT_PRODUCTS);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    // Confirm dashboard loaded
    await expect(page.locator('#admin-gate')).toBeHidden();
    await expect(page.locator('#admin-wrap')).toBeVisible();
}

/* ════════════════════════════════════════════════════════════════
   1. PRODUCT PRICE EDIT
   Flow: navigate to Costs tab → click Edit on T-Shirt →
         change $28 to $25 in paf-sell → click Update →
         verify new price in card and in localStorage
════════════════════════════════════════════════════════════════ */

test.describe('Product price management', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await page.click('.admin-tab[data-tab="costs"]');
        await page.waitForTimeout(500);
    });

    test('Admin changes T-Shirt sell price from $28 to $25 — reflects in card and localStorage', async ({ page }) => {

        /* ── Step 1: Confirm current price shows $28 ── */
        const shirtCard = page.locator('#product-grid .product-card', { hasText: 'BoxRetreat T-Shirt' });
        await expect(shirtCard).toBeVisible();
        await expect(shirtCard.locator('.pc-sell')).toContainText('28');

        /* ── Step 2: Click the Edit button on that card ── */
        await shirtCard.locator('.btn-edit-product').click();
        await page.waitForTimeout(300);

        // Confirm form was populated with T-Shirt data
        await expect(page.locator('#paf-name')).toHaveValue('BoxRetreat T-Shirt');
        await expect(page.locator('#paf-sell')).toHaveValue('28');

        /* ── Step 3: Update sell price to $25 ── */
        await page.locator('#paf-sell').click({ clickCount: 3 });
        await page.locator('#paf-sell').fill('25');

        /* ── Step 4: Submit (button text changes to "Update" when in edit mode) ── */
        await page.locator('#btn-add-product').click();
        await page.waitForTimeout(500);

        /* ── Step 5: Verify card shows $25 ── */
        const updatedCard = page.locator('#product-grid .product-card', { hasText: 'BoxRetreat T-Shirt' });
        await expect(updatedCard.locator('.pc-sell')).toContainText('25');

        /* ── Step 6: Verify localStorage was updated ── */
        const stored = await page.evaluate(() => {
            const products = JSON.parse(localStorage.getItem('br_products') || '[]');
            return products.find(p => p.id === 'PROD-SHIRT');
        });
        expect(stored).toBeTruthy();
        expect(Number(stored.sellPrice)).toBe(25);
    });

    test('Margin recalculates automatically: T-Shirt $25 sell - $12 cost = $13 margin', async ({ page }) => {
        const shirtCard = page.locator('#product-grid .product-card', { hasText: 'BoxRetreat T-Shirt' });
        await shirtCard.locator('.btn-edit-product').click();
        await page.waitForTimeout(300);

        await page.locator('#paf-sell').click({ clickCount: 3 });
        await page.locator('#paf-sell').fill('25');
        await page.locator('#btn-add-product').click();
        await page.waitForTimeout(500);

        const marginText = await page.locator('#product-grid .product-card', { hasText: 'BoxRetreat T-Shirt' })
                                      .locator('.pc-margin')
                                      .textContent();
        // margin = 25 - 12 = $13
        expect(marginText).toMatch(/\$13/);
    });

    test('Admin can add a new product and it appears in the grid', async ({ page }) => {
        await page.fill('#paf-name',              'Reef-Safe Sunscreen');
        await page.selectOption('#paf-category',  'general');
        await page.fill('#paf-sell',              '18');
        await page.fill('#paf-cost',              '7');
        await page.fill('#paf-stock',             '40');

        await page.locator('#btn-add-product').click();
        await page.waitForTimeout(500);

        const newCard = page.locator('#product-grid .product-card', { hasText: 'Reef-Safe Sunscreen' });
        await expect(newCard).toBeVisible();
        await expect(newCard.locator('.pc-sell')).toContainText('18');
    });

    test('Daily operational cost can be updated and persists in localStorage', async ({ page }) => {
        const input = page.locator('#opcost-input');
        await expect(input).toBeVisible();

        await input.click({ clickCount: 3 });
        await input.fill('55');

        await page.locator('#btn-save-opcost').click();
        await page.waitForTimeout(400);

        // CostStore.setDailyOpCost saves as string under 'br_daily_op_cost'
        const stored = await page.evaluate(() => localStorage.getItem('br_daily_op_cost'));
        expect(Number(stored)).toBe(55);
    });
});

/* ════════════════════════════════════════════════════════════════
   2. COST LOG — ad spend entry
   Form IDs: cost-date, cost-type, cost-desc, cost-amount (inside #cost-entry-form)
════════════════════════════════════════════════════════════════ */

test.describe('Cost log entries', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await page.evaluate(() => localStorage.removeItem('br_costs'));
        await page.click('.admin-tab[data-tab="costs"]');
        await page.waitForTimeout(500);
    });

    test('Admin can log a Meta ad spend entry and see it in the cost table', async ({ page }) => {
        const today = new Date().toISOString().split('T')[0];

        // Form is inside #cost-entry-form
        await page.fill('#cost-date',   today);
        await page.selectOption('#cost-type', 'adspend');
        await page.fill('#cost-desc',   'Meta Summer Surf campaign');
        await page.fill('#cost-amount', '10');

        await page.locator('#cost-entry-form button[type="submit"]').click();
        await page.waitForTimeout(500);

        // The table renders via renderCostTable() into #costs-body
        const tbody = page.locator('#costs-body');
        await expect(tbody).toContainText('Meta Summer Surf campaign');
        await expect(tbody).toContainText('10');
    });

    test('Cost entry is persisted in localStorage with correct type and amount', async ({ page }) => {
        const today = new Date().toISOString().split('T')[0];

        await page.fill('#cost-date',         today);
        await page.selectOption('#cost-type', 'property');
        await page.fill('#cost-desc',         'Electricity bill');
        await page.fill('#cost-amount',       '45');

        await page.locator('#cost-entry-form button[type="submit"]').click();
        await page.waitForTimeout(500);

        const costs = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('br_costs') || '[]')
        );
        const entry = costs.find(c => c.description === 'Electricity bill');
        expect(entry).toBeTruthy();
        expect(entry.amount).toBe(45);
        expect(entry.type).toBe('property');
    });
});

/* ════════════════════════════════════════════════════════════════
   3. LEAD REGISTRATION
   Form IDs: lead-date, lead-type, lead-name, lead-email,
             lead-revenue, lead-cpa, lead-opcost, lead-cogs, lead-source
   Submit: #lead-form button[type="submit"]
   Table: .leads-table > tbody (or #leads-tbody)
════════════════════════════════════════════════════════════════ */

test.describe('Lead registration', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
        await page.evaluate(() => localStorage.removeItem('br_leads'));
        await page.click('.admin-tab[data-tab="leads"]');
        await page.waitForTimeout(500);
    });

    test('Admin registers a rental lead and it appears in the leads table', async ({ page }) => {
        const today = new Date().toISOString().split('T')[0];

        await page.fill('#lead-date',            today);
        await page.selectOption('#lead-type',    'rental');
        await page.fill('#lead-name',            'Carlos Rivera');
        await page.fill('#lead-email',           'carlos@test.com');
        await page.fill('#lead-revenue',         '150');
        await page.fill('#lead-cpa',             '70');
        await page.fill('#lead-opcost',          '30');
        await page.fill('#lead-cogs',            '0');
        await page.selectOption('#lead-source',  'meta');

        await page.locator('#lead-form button[type="submit"]').click();
        await page.waitForTimeout(500);

        const table = page.locator('.leads-table');
        await expect(table).toContainText('Carlos Rivera');
        await expect(table).toContainText('150');
    });

    test('Registered lead shows correct net profit: $190 revenue - $130 costs = $60', async ({ page }) => {
        const today = new Date().toISOString().split('T')[0];

        await page.fill('#lead-date',           today);
        await page.selectOption('#lead-type',   'rental');
        await page.fill('#lead-name',           'Ana Test');
        await page.fill('#lead-email',          'ana@test.com');
        await page.fill('#lead-revenue',        '190');
        await page.fill('#lead-cpa',            '70');
        await page.fill('#lead-opcost',         '30');
        await page.fill('#lead-cogs',           '30');
        await page.selectOption('#lead-source', 'google');

        await page.locator('#lead-form button[type="submit"]').click();
        await page.waitForTimeout(500);

        // Net profit = $190 - ($70 + $30 + $30) = $60
        const table = page.locator('.leads-table');
        await expect(table).toContainText('Ana Test');
        await expect(table).toContainText('60');
    });

    test('Lead count in localStorage increases by 1 after adding', async ({ page }) => {
        const before = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('br_leads') || '[]').length
        );

        const today = new Date().toISOString().split('T')[0];
        await page.fill('#lead-date',           today);
        await page.selectOption('#lead-type',   'product');
        await page.fill('#lead-name',           'Shop Customer');
        await page.fill('#lead-email',          'shop@test.com');
        await page.fill('#lead-revenue',        '40');
        await page.fill('#lead-cpa',            '0');
        await page.fill('#lead-opcost',         '0');
        await page.fill('#lead-cogs',           '30');
        await page.selectOption('#lead-source', 'organic');

        await page.locator('#lead-form button[type="submit"]').click();
        await page.waitForTimeout(500);

        const after = await page.evaluate(() =>
            JSON.parse(localStorage.getItem('br_leads') || '[]').length
        );
        expect(after).toBe(before + 1);
    });
});

/* ════════════════════════════════════════════════════════════════
   4. P&L REPORT FILTER — Today / Week / Month
   Buttons: .period-btn[data-period="today|week|month"]
   KPI IDs: #rep-revenue, #rep-costs, #rep-profit, #rep-margin
════════════════════════════════════════════════════════════════ */

test.describe('P&L report period filter', () => {

    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);

        const today = new Date();
        const fmt   = d => d.toISOString().split('T')[0];
        const weekAgo  = new Date(today); weekAgo.setDate(today.getDate() - 7);
        const monthAgo = new Date(today); monthAgo.setDate(today.getDate() - 20);

        await page.evaluate(({ t, w, m }) => {
            localStorage.setItem('br_leads', JSON.stringify([
                { id: 'L1', type: 'rental',  date: t, revenue: 150, costCPA: 70, opCost: 30, cogs: 0,  source: 'meta' },
                { id: 'L2', type: 'product', date: t, revenue:  40, costCPA:  0, opCost:  0, cogs: 30, source: 'organic' },
                { id: 'L3', type: 'rental',  date: w, revenue: 500, costCPA: 70, opCost: 30, cogs: 0,  source: 'google' },
                { id: 'L4', type: 'rental',  date: m, revenue: 750, costCPA: 70, opCost: 30, cogs: 0,  source: 'meta' },
            ]));
            localStorage.setItem('br_costs', JSON.stringify([
                { id: 'C1', type: 'adspend', date: t, amount: 10, platform: 'meta' },
                { id: 'C2', type: 'adspend', date: w, amount: 15, platform: 'google' },
                { id: 'C3', type: 'adspend', date: m, amount: 25, platform: 'meta' },
            ]));
        }, { t: fmt(today), w: fmt(weekAgo), m: fmt(monthAgo) });

        await page.click('.admin-tab[data-tab="reports"]');
        await page.waitForTimeout(700);
    });

    test('"Today" filter shows $190 gross revenue (rental $150 + product $40)', async ({ page }) => {
        await page.click('.period-btn[data-period="today"]');
        await page.waitForTimeout(400);

        const rev = await page.locator('#rep-revenue').textContent();
        expect(rev).toContain('190');
    });

    test('"Month" filter returns higher revenue than "Today"', async ({ page }) => {
        await page.click('.period-btn[data-period="today"]');
        await page.waitForTimeout(400);
        const todayText = await page.locator('#rep-revenue').textContent();
        const todayNum  = parseFloat((todayText || '').replace(/[^0-9.]/g, ''));

        await page.click('.period-btn[data-period="month"]');
        await page.waitForTimeout(400);
        const monthText = await page.locator('#rep-revenue').textContent();
        const monthNum  = parseFloat((monthText || '').replace(/[^0-9.]/g, ''));

        expect(monthNum).toBeGreaterThan(todayNum);
    });

    test('Active period button gains the "active" CSS class on click', async ({ page }) => {
        await page.click('.period-btn[data-period="week"]');
        await page.waitForTimeout(400);

        await expect(page.locator('.period-btn[data-period="week"]')).toHaveClass(/active/);
        await expect(page.locator('.period-btn[data-period="today"]')).not.toHaveClass(/active/);
    });

    test('P&L statement renders at least 9 rows', async ({ page }) => {
        await page.click('.period-btn[data-period="month"]');
        await page.waitForTimeout(400);

        const rows  = page.locator('#pnl-body .pnl-row');
        const count = await rows.count();
        expect(count).toBeGreaterThanOrEqual(9);
    });

    test('All 3 primary KPI cards display a dollar amount (not empty)', async ({ page }) => {
        await page.click('.period-btn[data-period="month"]');
        await page.waitForTimeout(400);

        for (const id of ['rep-revenue', 'rep-costs', 'rep-profit']) {
            const text = await page.locator(`#${id}`).textContent();
            expect(text).toMatch(/\$/);
        }
    });
});
