/**
 * admin-security.spec.js — Playwright E2E: Role-Based UI Access Control
 * ─────────────────────────────────────────────────────────────────────
 * Verifies that the admin dashboard is protected by the role gate:
 *
 *   1. Client / anonymous user visiting /admin.html sees the login gate
 *      (not the dashboard content).
 *   2. Admin user (valid role in localStorage) sees the full dashboard
 *      with all financial tabs.
 *   3. Client with 'client' role explicitly set is still blocked.
 *
 * Run:  npx playwright test tests/e2e/admin-security.spec.js --headed
 */

// @ts-check
const { test, expect } = require('@playwright/test');

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */

/** Navigate to admin.html with a specific role pre-set in localStorage */
async function gotoAdminAs(page, role) {
    // Set role before navigating so DOMContentLoaded sees it
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(r => localStorage.setItem('br_user_role', r), role);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600); // allow initRoleGuard() async to resolve
}

/** Navigate to admin.html with NO role in localStorage (anonymous) */
async function gotoAdminAnonymous(page) {
    await page.goto('/admin.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
}

/* ════════════════════════════════════════════════════════════════
   1. ANONYMOUS USER — gate must be visible
════════════════════════════════════════════════════════════════ */

test.describe('Anonymous user visiting /admin.html', () => {

    test('sees the login gate, not the dashboard content', async ({ page }) => {
        await gotoAdminAnonymous(page);

        const gate = page.locator('#admin-gate');
        await expect(gate).toBeVisible({ timeout: 3000 });

        // Dashboard content must be hidden
        const wrap = page.locator('#admin-wrap');
        await expect(wrap).toBeHidden();
    });

    test('gate contains an email and password input', async ({ page }) => {
        await gotoAdminAnonymous(page);

        await expect(page.locator('#gate-email')).toBeVisible();
        await expect(page.locator('#gate-password')).toBeVisible();
    });

    test('gate contains a submit button labeled "Enter Dashboard"', async ({ page }) => {
        await gotoAdminAnonymous(page);

        const btn = page.locator('#admin-gate-form button[type="submit"]');
        await expect(btn).toBeVisible();
        await expect(btn).toContainText(/Enter Dashboard/i);
    });

    test('wrong credentials show an error message, not the dashboard', async ({ page }) => {
        await gotoAdminAnonymous(page);

        await page.fill('#gate-email',    'hacker@evil.com');
        await page.fill('#gate-password', 'wrong-password');
        await page.click('#admin-gate-form button[type="submit"]');
        await page.waitForTimeout(1500); // allow async auth attempt

        // Gate must still be visible after failed login
        await expect(page.locator('#admin-gate')).toBeVisible();
        // Dashboard must remain hidden
        await expect(page.locator('#admin-wrap')).toBeHidden();
    });
});

/* ════════════════════════════════════════════════════════════════
   2. CLIENT ROLE — still blocked even with explicit client flag
════════════════════════════════════════════════════════════════ */

test.describe('Client user trying to access /admin.html', () => {

    test('client role is blocked — gate is shown, dashboard is hidden', async ({ page }) => {
        await gotoAdminAs(page, 'client');

        await expect(page.locator('#admin-gate')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('#admin-wrap')).toBeHidden();
    });

    test('direct URL navigation to admin.html by client does not expose dashboard', async ({ page }) => {
        // Must visit the origin first so localStorage.setItem works before navigating
        await page.goto('/account.html', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => {
            localStorage.clear();
            localStorage.setItem('br_user_role', 'client');
        });
        await page.goto('/admin.html', { waitUntil: 'networkidle' });
        await page.waitForTimeout(600);

        await expect(page.locator('#admin-wrap')).toBeHidden();
    });

    test('financial tabs are not accessible to clients', async ({ page }) => {
        await gotoAdminAs(page, 'client');

        // Even if a client inspects the source and tries to click a tab, the wrap is hidden
        const tabReports = page.locator('.admin-tab[data-tab="reports"]');
        // Tab is in DOM but content wrapper is hidden
        const wrapVisible = await page.locator('#admin-wrap').isVisible();
        expect(wrapVisible).toBe(false);
    });
});

/* ════════════════════════════════════════════════════════════════
   3. ADMIN ROLE — full dashboard access
════════════════════════════════════════════════════════════════ */

test.describe('Admin user accessing /admin.html', () => {

    test.beforeEach(async ({ page }) => {
        await gotoAdminAs(page, 'admin');
    });

    test('gate is hidden and dashboard content is visible', async ({ page }) => {
        await expect(page.locator('#admin-gate')).toBeHidden();
        await expect(page.locator('#admin-wrap')).toBeVisible();
    });

    test('all 7 admin tab buttons are rendered', async ({ page }) => {
        const tabs = page.locator('.admin-tab');
        await expect(tabs).toHaveCount(7);
    });

    test('financial tabs exist: Costs & Products, Leads, P&L Reports', async ({ page }) => {
        await expect(page.locator('.admin-tab[data-tab="costs"]')).toBeAttached();
        await expect(page.locator('.admin-tab[data-tab="leads"]').first()).toBeAttached();
        await expect(page.locator('.admin-tab[data-tab="reports"]')).toBeAttached();
    });

    test('Costs & Products tab panel loads with product cards', async ({ page }) => {
        await page.click('.admin-tab[data-tab="costs"]');
        await page.waitForTimeout(400);

        // Product grid should have the 6 default products seeded
        const cards = page.locator('#product-grid .product-card');
        await expect(cards).toHaveCount(6);
    });

    test('P&L Reports tab renders KPI cards with financial data', async ({ page }) => {
        // Seed a test lead first
        await page.evaluate(() => {
            localStorage.setItem('br_leads', JSON.stringify([{
                id: 'LEAD-TEST', type: 'rental', date: new Date().toISOString().split('T')[0],
                revenue: 190, costCPA: 70, opCost: 30, cogs: 0,
                source: 'meta', createdAt: new Date().toISOString(),
            }]));
        });

        await page.click('.admin-tab[data-tab="reports"]');
        await page.waitForTimeout(600);

        const revenueKPI = page.locator('#rep-revenue');
        await expect(revenueKPI).toBeVisible();
        const text = await revenueKPI.textContent();
        // Should show a dollar amount
        expect(text).toMatch(/\$/);
    });

    test('Marketing ROI tab renders KPI row', async ({ page }) => {
        await page.click('.admin-tab[data-tab="marketing"]');
        await page.waitForTimeout(400);

        const kpiRow = page.locator('.mkt-kpi-row');
        await expect(kpiRow).toBeVisible();
    });
});

/* ════════════════════════════════════════════════════════════════
   4. SESSION ISOLATION — role does not leak between tabs
════════════════════════════════════════════════════════════════ */

test.describe('Session isolation', () => {

    test('admin session in one context does not grant access in a fresh anonymous context', async ({ browser }) => {
        // Context 1: admin logs in
        const ctx1  = await browser.newContext();
        const page1 = await ctx1.newPage();
        await page1.goto('/admin.html', { waitUntil: 'domcontentloaded' });
        await page1.evaluate(() => localStorage.setItem('br_user_role', 'admin'));
        await page1.reload({ waitUntil: 'networkidle' });
        await page1.waitForTimeout(600);
        await expect(page1.locator('#admin-wrap')).toBeVisible();

        // Context 2: fresh anonymous context (separate localStorage)
        const ctx2  = await browser.newContext();
        const page2 = await ctx2.newPage();
        await page2.goto('/admin.html', { waitUntil: 'networkidle' });
        await page2.waitForTimeout(600);
        await expect(page2.locator('#admin-gate')).toBeVisible();
        await expect(page2.locator('#admin-wrap')).toBeHidden();

        await ctx1.close();
        await ctx2.close();
    });
});
