import { test, expect, Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mock /api/gear-checkout to return a fake Stripe URL without hitting the real API */
async function mockCheckoutSuccess(page: Page) {
  await page.route('**/api/gear-checkout', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://checkout.stripe.com/pay/test_mock_session' }),
    });
  });
}

async function mockCheckoutError(page: Page, message = 'Stripe error') {
  await page.route('**/api/gear-checkout', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    });
  });
}

/** Click the first available (non-disabled) day in the calendar, then a day 3 days later */
async function selectDates(page: Page) {
  const days = page.locator('table button:not([disabled]):not([aria-disabled="true"])');
  await days.first().click();
  await days.nth(3).click();
}

/** Fill the customer info form */
async function fillForm(page: Page, name = 'Jane Doe', email = 'jane@example.com') {
  await page.getByPlaceholder(/your name/i).fill(name);
  await page.getByPlaceholder(/your email/i).fill(email);
}

// ─── Gear selection page ───────────────────────────────────────────────────────

test.describe('Gear page — item grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gear');
  });

  test('shows 6 gear items', async ({ page }) => {
    const cards = page.locator('[class*="gearGrid"] [class*="gearCard"], [class*="gear-grid"] [class*="gear-card"]');
    // Use a more resilient selector — look for the price "$" signs as proxy for gear cards
    await expect(page.getByText('Surfboard')).toBeVisible();
    await expect(page.getByText('Snorkel Set')).toBeVisible();
    await expect(page.getByText('Kayak')).toBeVisible();
    await expect(page.getByText('GoPro Camera')).toBeVisible();
    await expect(page.getByText('Beach Bike')).toBeVisible();
    await expect(page.getByText('Beach Set')).toBeVisible();
  });

  test('shows price per day for each item', async ({ page }) => {
    await expect(page.getByText('$35')).toBeVisible();
    await expect(page.getByText('$15')).toBeVisible();
    await expect(page.getByText('$45')).toBeVisible();
  });

  test('clicking a gear card reveals the booking form', async ({ page }) => {
    await page.getByText('Surfboard').first().click();
    await expect(page.getByText(/pick your dates/i)).toBeVisible();
    await expect(page.locator('table')).toBeVisible(); // calendar
  });

  test('selecting an item highlights it', async ({ page }) => {
    await page.getByText('Kayak').first().click();
    // The booking panel shows the selected item name
    await expect(page.getByRole('heading', { name: /kayak/i })).toBeVisible();
  });
});

// ─── URL pre-selection ─────────────────────────────────────────────────────────

test.describe('Gear page — ?item= query param', () => {
  test('pre-selects item from URL and shows booking form', async ({ page }) => {
    await page.goto('/gear?item=surfboard');
    // Calendar should be visible immediately (item pre-selected)
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText(/surfboard/i).first()).toBeVisible();
  });

  test('pre-selects kayak from URL', async ({ page }) => {
    await page.goto('/gear?item=kayak');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByText(/kayak/i).first()).toBeVisible();
  });
});

// ─── Booking form ──────────────────────────────────────────────────────────────

test.describe('Gear page — booking form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/gear?item=surfboard');
    await expect(page.locator('table')).toBeVisible();
  });

  test('Reserve button is disabled until dates and form are filled', async ({ page }) => {
    const btn = page.getByRole('button', { name: /reserve/i });
    await expect(btn).toBeDisabled();
  });

  test('Reserve button stays disabled after dates but no name/email', async ({ page }) => {
    await selectDates(page);
    const btn = page.getByRole('button', { name: /reserve/i });
    await expect(btn).toBeDisabled();
  });

  test('Reserve button stays disabled after name/email but no dates', async ({ page }) => {
    await fillForm(page);
    const btn = page.getByRole('button', { name: /reserve/i });
    await expect(btn).toBeDisabled();
  });

  test('Reserve button enables after dates + name + email are filled', async ({ page }) => {
    await selectDates(page);
    await fillForm(page);
    const btn = page.getByRole('button', { name: /reserve/i });
    await expect(btn).toBeEnabled();
  });

  test('shows price summary with rental total and deposit after dates selected', async ({ page }) => {
    await selectDates(page);
    // Should show deposit line
    await expect(page.getByText(/\$20/)).toBeVisible();
    await expect(page.getByText(/deposit/i)).toBeVisible();
  });

  test('shows "Reserving..." while submitting', async ({ page }) => {
    // Delay the mock response so we can catch the loading state
    await page.route('**/api/gear-checkout', async route => {
      await new Promise(r => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/pay/mock' }),
      });
    });

    await selectDates(page);
    await fillForm(page);
    await page.getByRole('button', { name: /reserve/i }).click();
    await expect(page.getByRole('button', { name: /reserving/i })).toBeVisible();
  });

  test('redirects to Stripe URL on successful checkout', async ({ page }) => {
    await mockCheckoutSuccess(page);
    await selectDates(page);
    await fillForm(page);

    // Intercept navigation to Stripe
    const [request] = await Promise.all([
      page.waitForRequest('**/checkout.stripe.com/**'),
      page.getByRole('button', { name: /reserve/i }).click(),
    ]);
    expect(request.url()).toContain('checkout.stripe.com');
  });

  test('shows error message when API returns 500', async ({ page }) => {
    await mockCheckoutError(page, 'Payment system unavailable');
    await selectDates(page);
    await fillForm(page);
    await page.getByRole('button', { name: /reserve/i }).click();
    await expect(page.getByText(/payment system unavailable/i)).toBeVisible();
  });

  test('sends correct data to the checkout API', async ({ page }) => {
    let capturedBody: Record<string, unknown> = {};
    await page.route('**/api/gear-checkout', async route => {
      capturedBody = JSON.parse(route.request().postData() ?? '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/pay/mock' }),
      });
    });

    await selectDates(page);
    await fillForm(page, 'Test User', 'test@example.com');

    await Promise.all([
      page.waitForRequest('**/checkout.stripe.com/**').catch(() => {}),
      page.waitForRequest('**/api/gear-checkout**'),
      page.getByRole('button', { name: /reserve/i }).click(),
    ]);

    expect(capturedBody.itemId).toBe('surfboard');
    expect(capturedBody.customerName).toBe('Test User');
    expect(capturedBody.customerEmail).toBe('test@example.com');
    expect(capturedBody.startDate).toBeTruthy();
    expect(capturedBody.endDate).toBeTruthy();
  });
});

// ─── Gear item switching ───────────────────────────────────────────────────────

test.describe('Gear page — switching items', () => {
  test('can switch from one item to another', async ({ page }) => {
    await page.goto('/gear');
    await page.getByText('Surfboard').first().click();
    await expect(page.getByRole('heading', { name: /surfboard/i })).toBeVisible();

    await page.getByText('Kayak').first().click();
    await expect(page.getByRole('heading', { name: /kayak/i })).toBeVisible();
  });
});
