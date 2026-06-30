// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/gear-release-deposit/route';
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

const BASE_URL = 'http://localhost/api/gear-release-deposit';

const RETURNED_RENTAL = {
  rental_id: 'GR-TEST01',
  status: 'returned',
  deposit_cents: 2000,
  stripe_payment_intent_id: 'pi_test_abc123',
};

function setupSuccessClient() {
  const mock = makeMockSupabase({ singleData: RETURNED_RENTAL });
  mock._mockFrom
    .mockReset()
    .mockReturnValueOnce(mock._selectChain)
    .mockReturnValueOnce(mock._updateChain);
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
  (stripe.refunds.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 're_test456' });
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('POST /api/gear-release-deposit — happy path', () => {
  it('returns 200 { ok: true, refundId } on success', async () => {
    setupSuccessClient();
    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.refundId).toBe('re_test456');
  });

  it('calls stripe.refunds.create with the correct payment intent and amount', async () => {
    setupSuccessClient();
    await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    expect(stripe.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_test_abc123',
      amount: 2000,
    });
  });

  it('updates rental to status "completed" with deposit_released_at', async () => {
    const mock = setupSuccessClient();
    await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    const updateArg = mock._updateChain.update.mock.calls[0][0];
    expect(updateArg.status).toBe('completed');
    expect(updateArg.deposit_released_at).toBeTruthy();
  });

  it('stores the Stripe refund ID in inspection_notes', async () => {
    const mock = setupSuccessClient();
    await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    const updateArg = mock._updateChain.update.mock.calls[0][0];
    expect(updateArg.inspection_notes).toContain('re_test456');
    expect(updateArg.inspection_notes).toContain('$20');
  });

  it('uses deposit_cents from the rental record, not a hardcoded value', async () => {
    const mock = makeMockSupabase({ singleData: { ...RETURNED_RENTAL, deposit_cents: 5000 } });
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._selectChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    (stripe.refunds.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 're_big' });

    await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 })
    );
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe('POST /api/gear-release-deposit — validation', () => {
  it('returns 400 when rentalId is missing', async () => {
    const res = await POST(makeJsonRequest(BASE_URL, {}) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing rentalId/i);
  });

  it('returns 404 when rental does not exist', async () => {
    const mock = makeMockSupabase({ singleData: null });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-GHOST' }) as never);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/rental not found/i);
  });

  it('returns 409 when deposit already released (status=completed)', async () => {
    const mock = makeMockSupabase({ singleData: { ...RETURNED_RENTAL, status: 'completed' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/deposit already released/i);
  });

  it('returns 409 when gear not returned yet (status=active)', async () => {
    const mock = makeMockSupabase({ singleData: { ...RETURNED_RENTAL, status: 'active' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/gear not returned yet/i);
  });

  it('returns 409 when status is pending', async () => {
    const mock = makeMockSupabase({ singleData: { ...RETURNED_RENTAL, status: 'pending' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    expect(res.status).toBe(409);
  });

  it('returns 400 when stripe_payment_intent_id is null', async () => {
    const mock = makeMockSupabase({
      singleData: { ...RETURNED_RENTAL, stripe_payment_intent_id: null },
    });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/no payment intent/i);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe('POST /api/gear-release-deposit — error paths', () => {
  it('returns 500 when Stripe refund throws', async () => {
    const mock = makeMockSupabase({ singleData: RETURNED_RENTAL });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    (stripe.refunds.create as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Stripe: card declined'));

    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Stripe: card declined');
  });
});
