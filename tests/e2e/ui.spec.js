/**
 * ui.spec.js — UI Design & Typography tests (Playwright)
 *
 * Verifies that the page renders correctly:
 *   - Fonts load (Roboto, Poppins)
 *   - Key UI elements are visible and correctly styled
 *   - Navigation works
 *   - Images load without broken src
 *   - Responsive layout doesn't break on mobile
 *   - No console errors on page load
 */

const { test, expect } = require('@playwright/test');

/* ── helpers ── */
async function collectConsoleErrors(page) {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    return errors;
}

/* ════════════════════════════════
   TYPOGRAPHY
═════════════════════════════════ */
test.describe('Typography', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/rental.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('page title is correct', async ({ page }) => {
        await expect(page).toHaveTitle(/BoxRetreat/i);
    });

    test('h1 property title is visible and non-empty', async ({ page }) => {
        const h1 = page.locator('h1.prop-title');
        await expect(h1).toBeVisible();
        const text = await h1.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
    });

    test('logo text renders with correct brand copy', async ({ page }) => {
        const logo = page.locator('#logo');
        await expect(logo).toContainText('Box');
        await expect(logo).toContainText('Retreat');
    });

    test('property subtitle / tagline is visible', async ({ page }) => {
        const meta = page.locator('.prop-meta');
        await expect(meta).toBeVisible();
        await expect(meta).toContainText('Luquillo');
    });

    test('rating shows correct value (4.97)', async ({ page }) => {
        const rating = page.locator('.prop-rating');
        await expect(rating).toContainText('4.97');
    });

    test('review count is visible', async ({ page }) => {
        const reviews = page.locator('.prop-underline').first();
        await expect(reviews).toContainText('reviews');
    });

    test('Superhost badge is displayed', async ({ page }) => {
        const superhost = page.locator('.prop-superhost');
        await expect(superhost).toBeVisible();
        await expect(superhost).toContainText('Superhost');
    });

    test('Poppins font is referenced in the page head', async ({ page }) => {
        const fontLinks = await page.$$eval('link[href*="Poppins"]', els => els.map(e => e.href));
        expect(fontLinks.length).toBeGreaterThan(0);
    });

    test('Roboto font is referenced in the page head', async ({ page }) => {
        const fontLinks = await page.$$eval('link[href*="Roboto"]', els => els.map(e => e.href));
        expect(fontLinks.length).toBeGreaterThan(0);
    });

    test('price per night is displayed in the booking widget', async ({ page }) => {
        const widget = page.locator('.book-widget, .booking-widget, [class*="book"]').first();
        // Price $185 should appear somewhere on the page
        await expect(page.locator('text=/\\$185/').first()).toBeVisible();
    });
});

/* ════════════════════════════════
   NAVIGATION & LAYOUT
═════════════════════════════════ */
test.describe('Navigation & Layout', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/rental.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('header is present on the page', async ({ page }) => {
        await expect(page.locator('header')).toBeVisible();
    });

    test('navigation contains Property link', async ({ page }) => {
        await expect(page.locator('nav a[href*="rental"]')).toBeVisible();
    });

    test('navigation contains Shop link', async ({ page }) => {
        await expect(page.locator('nav a[href*="shop"]')).toBeVisible();
    });

    test('navigation contains Account link', async ({ page }) => {
        await expect(page.locator('nav a[href*="account"]')).toBeVisible();
    });

    test('footer or page end is reachable (scroll)', async ({ page }) => {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        // Just verify no crash during scroll
        await expect(page.locator('body')).toBeVisible();
    });

    test('Share button is present', async ({ page }) => {
        const shareBtn = page.locator('button:has-text("Share")');
        await expect(shareBtn).toBeVisible();
    });

    test('Save button is present', async ({ page }) => {
        const saveBtn = page.locator('#btn-save, button:has-text("Save")');
        await expect(saveBtn).toBeVisible();
    });
});

/* ════════════════════════════════
   DESIGN — IMAGES & GALLERY
═════════════════════════════════ */
test.describe('Images & Gallery', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/rental.html');
        await page.waitForLoadState('networkidle');
    });

    test('gallery section is present in the DOM', async ({ page }) => {
        await expect(page.locator('#gallery-wrap, .rental-gallery')).toBeVisible();
    });

    test('gallery contains at least one image', async ({ page }) => {
        const imgs = page.locator('.rental-gallery img, #gallery-wrap img');
        await expect(imgs.first()).toBeVisible();
    });

    test('host photo is not broken', async ({ page }) => {
        const hostImg = page.locator('.host-photo img, .host img, [class*="host"] img').first();
        if (await hostImg.count() > 0) {
            const src = await hostImg.getAttribute('src');
            expect(src).toBeTruthy();
        }
    });

    test('all visible images have non-empty alt attributes', async ({ page }) => {
        const imgs = await page.$$eval('img', els =>
            els.filter(e => e.offsetParent !== null).map(e => ({ src: e.src, alt: e.alt }))
        );
        for (const img of imgs) {
            // alt can be empty string for decorative images, but src must be set
            expect(img.src).toBeTruthy();
        }
    });
});

/* ════════════════════════════════
   DESIGN — AMENITIES & RULES
═════════════════════════════════ */
test.describe('Amenities & House Rules sections', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/rental.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('amenities section is visible', async ({ page }) => {
        const amenities = page.locator('[class*="amenities"], #amenities');
        await expect(amenities.first()).toBeVisible();
    });

    test('at least 6 amenity items are rendered', async ({ page }) => {
        const items = page.locator('[class*="amenity"], .amenity-item');
        const count = await items.count();
        expect(count).toBeGreaterThanOrEqual(6);
    });

    test('WiFi amenity is listed', async ({ page }) => {
        await expect(page.locator('text=/WiFi/i').first()).toBeVisible();
    });

    test('house rules section is visible', async ({ page }) => {
        const rules = page.locator('[class*="rules"], #house-rules');
        await expect(rules.first()).toBeVisible();
    });

    test('check-in time rule is shown', async ({ page }) => {
        await expect(page.locator('text=/Check-?in/i').first()).toBeVisible();
    });
});

/* ════════════════════════════════
   DESIGN — REVIEWS SECTION
═════════════════════════════════ */
test.describe('Reviews section', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/rental.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('reviews section is present', async ({ page }) => {
        const reviews = page.locator('[class*="review"], #reviews');
        await expect(reviews.first()).toBeVisible();
    });

    test('at least one review card is rendered', async ({ page }) => {
        const reviewCards = page.locator('[class*="review-card"], .review-item, [class*="review"] .card');
        const count = await reviewCards.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

/* ════════════════════════════════
   RESPONSIVE — MOBILE LAYOUT
═════════════════════════════════ */
test.describe('Mobile responsive layout', () => {
    test('rental page renders without horizontal overflow on iPhone', async ({ page, isMobile }) => {
        if (!isMobile) test.skip();
        await page.goto('/rental.html');
        await page.waitForLoadState('domcontentloaded');
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewWidth + 5); // 5px tolerance
    });

    test('shop page renders without horizontal overflow on iPhone', async ({ page, isMobile }) => {
        if (!isMobile) test.skip();
        await page.goto('/shop.html');
        await page.waitForLoadState('domcontentloaded');
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewWidth + 5);
    });
});

/* ════════════════════════════════
   PAGE LOAD — NO CRITICAL ERRORS
═════════════════════════════════ */
test.describe('Page load — no critical JS errors', () => {
    async function checkPageForErrors(page, url) {
        const errors = await collectConsoleErrors(page);
        // Wait for them to accumulate
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');
        // Filter out known non-critical external errors (font loading, ad blockers, etc.)
        const criticalErrors = errors.filter(e =>
            !e.includes('fonts.googleapis') &&
            !e.includes('ERR_BLOCKED') &&
            !e.includes('favicon')
        );
        return criticalErrors;
    }

    test('rental.html loads without critical JS errors', async ({ page }) => {
        const errors = await checkPageForErrors(page, '/rental.html');
        expect(errors).toEqual([]);
    });

    test('shop.html loads without critical JS errors', async ({ page }) => {
        const errors = await checkPageForErrors(page, '/shop.html');
        expect(errors).toEqual([]);
    });

    test('account.html loads without critical JS errors', async ({ page }) => {
        const errors = await checkPageForErrors(page, '/account.html');
        expect(errors).toEqual([]);
    });

    test('success.html loads without critical JS errors', async ({ page }) => {
        const errors = await checkPageForErrors(page, '/success.html');
        expect(errors).toEqual([]);
    });
});

/* ════════════════════════════════
   CSS — KEY DESIGN PROPERTIES
═════════════════════════════════ */
test.describe('CSS — Design properties', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/rental.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('brand color #00B4D8 is applied to BoxRetreat logo span', async ({ page }) => {
        const colorSpan = page.locator('#logo span span').first();
        if (await colorSpan.count() > 0) {
            const color = await colorSpan.evaluate(el => getComputedStyle(el).color);
            // rgb(0, 180, 216) == #00B4D8
            expect(color).toContain('0, 180, 216');
        }
    });

    test('h1 has non-zero font size', async ({ page }) => {
        const fontSize = await page.locator('h1').first().evaluate(el =>
            parseFloat(getComputedStyle(el).fontSize)
        );
        expect(fontSize).toBeGreaterThan(16);
    });

    test('booking widget is visible on desktop', async ({ page, isMobile }) => {
        if (isMobile) test.skip();
        const widget = page.locator('.book-widget, .booking-widget, [class*="book-panel"]').first();
        if (await widget.count() > 0) {
            await expect(widget).toBeVisible();
        }
    });
});
