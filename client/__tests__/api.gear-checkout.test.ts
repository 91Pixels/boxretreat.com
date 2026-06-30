// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/gear-checkout/route';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { makeMockSupabase, makeJsonRequest } from './helpers/supabase-mock';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: vi.fn() } },
    refunds: { create: vi.fn() },
  },
}));
vi.mock('@/lib/lockers', () => ({
  countAvailableLockers: vi.fn().mockResolvedValue(3),
}));

const BASE_URL = 'http://localhost/api/gear-checkout';

const VALID_BODY = {
  itemId: 'surfboard',
  startDate: '2026-08-01',
  endDate: '2026-08-04', // 3 days
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
};

function setupSuccessClient() {
  const mock = makeMockSupabase();
  mock._mockFrom
    .mockReset()
    .mockReturnValueOnce(mock._insertChain)
    .mockReturnValueOnce(mock._updateChain);
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
  (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'sess_test123',
    url: 'https://checkout.stripe.com/pay/test123',
  });
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('POST /api/gear-checkout — happy path', () => {
  it('returns 200 with a Stripe checkout URL', async () => {
    setupSuccessClient();
    const res = await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.com/pay/test123');
  });

  it('inserts the rental with correct pricing for surfboard × 3 days', async () => {
    const mock = setupSuccessClient();
    await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);
    const row = mock._insertChain.insert.mock.calls[0][0];
    // surfboard $35/day × 3 days = $105 rental + $20 deposit = $125 total
    expect(row.daily_rate_cents).toBe(3500);
    expect(row.days).toBe(3);
    expect(row.rental_total_cents).toBe(10500);
    expect(row.deposit_cents).toBe(2000);
    expect(row.grand_total_cents).toBe(12500);
    expect(row.status).toBe('pending');
    expect(row.item_id).toBe('surfboard');
    expect(row.item_name).toBe('Surfboard');
    expect(row.customer_email).toBe('jane@example.com');
  });

  it('creates a Stripe session with two line items (rental + deposit)', async () => {
    setupSuccessClient();
    await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);
    const call = (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.line_items).toHaveLength(2);
    expect(call.line_items[0].price_data.unit_amount).toBe(10500);
    expect(call.line_items[1].price_data.unit_amount).toBe(2000);
    expect(call.mode).toBe('payment');
    expect(call.success_url).toContain('/gear/success?session_id={CHECKOUT_SESSION_ID}');
    expect(call.customer_email).toBe('jane@example.com');
  });

  it('saves the Stripe session ID to the rental record', async () => {
    const mock = setupSuccessClient();
    (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'sess_unique999',
      url: 'https://checkout.stripe.com/pay/x',
    });
    await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);
    const updateArg = mock._updateChain.update.mock.calls[0][0];
    expect(updateArg.stripe_session_id).toBe('sess_unique999');
  });

  it('calculates correctly for a 1-day bike rental', async () => {
    const mock = setupSuccessClient();
    await POST(makeJsonRequest(BASE_URL, {
      itemId: 'bike',
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      customerName: 'Joe Test',
      customerEmail: 'joe@test.com',
    }) as never);
    const row = mock._insertChain.insert.mock.calls[0][0];
    // bike $20/day × 1 day = $20 + $20 deposit = $40 total
    expect(row.daily_rate_cents).toBe(2000);
    expect(row.days).toBe(1);
    expect(row.rental_total_cents).toBe(2000);
    expect(row.grand_total_cents).toBe(4000);
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe('POST /api/gear-checkout — validation', () => {
  it('returns 400 when itemId is missing', async () => {
    const { itemId: _, ...body } = VALID_BODY;
    const res = await POST(makeJsonRequest(BASE_URL, body) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing required fields/i);
  });

  it('returns 400 when startDate is missing', async () => {
    const { startDate: _, ...body } = VALID_BODY;
    const res = await POST(makeJsonRequest(BASE_URL, body) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when endDate is missing', async () => {
    const { endDate: _, ...body } = VALID_BODY;
    const res = await POST(makeJsonRequest(BASE_URL, body) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when customerName is missing', async () => {
    const { customerName: _, ...body } = VALID_BODY;
    const res = await POST(makeJsonRequest(BASE_URL, body) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 when customerEmail is missing', async () => {
    const { customerEmail: _, ...body } = VALID_BODY;
    const res = await POST(makeJsonRequest(BASE_URL, body) as never);
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unknown gear item ID', async () => {
    const res = await POST(makeJsonRequest(BASE_URL, { ...VALID_BODY, itemId: 'unicycle' }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unknown gear item/i);
  });

  it('returns 400 when endDate equals startDate (0 days)', async () => {
    const res = await POST(makeJsonRequest(BASE_URL, {
      ...VALID_BODY,
      startDate: '2026-08-01',
      endDate: '2026-08-01',
    }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/end date must be after/i);
  });

  it('returns 400 when endDate is before startDate', async () => {
    const res = await POST(makeJsonRequest(BASE_URL, {
      ...VALID_BODY,
      startDate: '2026-08-05',
      endDate: '2026-08-01',
    }) as never);
    expect(res.status).toBe(400);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe('POST /api/gear-checkout — error paths', () => {
  it('returns 500 when Supabase insert fails', async () => {
    const mock = makeMockSupabase({ insertError: { message: 'DB error' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._insertChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const res = await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/could not create rental record/i);
  });

  it('returns 500 when Stripe throws', async () => {
    const mock = makeMockSupabase();
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._insertChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Stripe network error'));

    const res = await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Stripe network error');
  });
});
