# Gear Rental — Robust Unit Tests Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write comprehensive unit tests for all gear rental business logic: three API routes and the ReturnClient component, covering happy paths, all error branches, and edge cases.

**Architecture:** API route tests import the `POST` handler directly and call it with a mocked `Request`; Supabase and Stripe are `vi.mock`-ed at module level. The `ReturnClient` component is rendered with `@testing-library/react`; `fetch` is mocked globally. API tests run in Node environment (annotation at top of file); component tests use the default jsdom environment.

**Tech Stack:** Vitest · @testing-library/react · @testing-library/jest-dom · vi.mock · NextRequest (Web Request API) · NextResponse

---

## File Map

| Path | Responsibility |
|------|---------------|
| `client/__tests__/helpers/supabase-mock.ts` | Factory for a chainable Supabase client mock |
| `client/__tests__/api.gear-checkout.test.ts` | Tests for `/api/gear-checkout/route.ts` |
| `client/__tests__/api.gear-return.test.ts` | Tests for `/api/gear-return/route.ts` |
| `client/__tests__/api.gear-release-deposit.test.ts` | Tests for `/api/gear-release-deposit/route.ts` |
| `client/__tests__/ReturnClient.test.tsx` | Component tests for `ReturnClient` |

---

## Task 1: Shared Mock Helpers

**Files:**
- Create: `client/__tests__/helpers/supabase-mock.ts`

- [ ] **Step 1: Create the helpers file**

```ts
// client/__tests__/helpers/supabase-mock.ts
import { vi } from 'vitest';

export interface SupabaseMockOpts {
  /** Returned by .select().eq().single() */
  singleData?: object | null;
  singleError?: object | null;
  /** Returned by .insert() */
  insertError?: object | null;
  /** Returned by .update().eq() */
  updateError?: object | null;
  /** Returned by storage.from().upload() */
  storageUploadError?: object | null;
  /** Returned by storage.from().getPublicUrl() */
  storagePublicUrl?: string;
}

/**
 * Creates a mock Supabase client where:
 *   - first  from() call → select chain  (.select.eq.single)
 *   - second from() call → insert chain  (.insert)
 *   - third  from() call → update chain  (.update.eq) – returns Promise
 *
 * For routes that call from() in a different order, override mockFrom manually.
 */
export function makeMockSupabase(opts: SupabaseMockOpts = {}) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: opts.singleData ?? null,
      error: opts.singleError ?? null,
    }),
  };

  const insertChain = {
    insert: vi.fn().mockResolvedValue({ error: opts.insertError ?? null }),
  };

  // update().eq() is awaited — eq() must return a Promise
  const updateChain = {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: opts.updateError ?? null }),
    }),
  };

  const storageBucket = {
    upload: vi.fn().mockResolvedValue({ error: opts.storageUploadError ?? null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: opts.storagePublicUrl ?? 'https://storage.example.com/photo.jpg' },
    }),
  };

  const mockFrom = vi.fn()
    .mockReturnValueOnce(selectChain)
    .mockReturnValueOnce(insertChain)
    .mockReturnValueOnce(updateChain);

  const client = {
    from: mockFrom,
    storage: {
      from: vi.fn().mockReturnValue(storageBucket),
    },
    // Expose internals for assertion in tests
    _selectChain: selectChain,
    _insertChain: insertChain,
    _updateChain: updateChain,
    _storageBucket: storageBucket,
    _mockFrom: mockFrom,
  };

  return client;
}

/** Creates a minimal fake File object usable in FormData */
export function makeFile(name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File(['fake-image-content'], name, { type });
}

/** Creates a NextRequest-compatible Request with a JSON body */
export function makeJsonRequest(url: string, body: object): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Creates a NextRequest-compatible Request with FormData body */
export function makeFormRequest(url: string, fields: Record<string, string | File | File[]>): Request {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      value.forEach(v => fd.append(key, v));
    } else {
      fd.append(key, value);
    }
  }
  return new Request(url, { method: 'POST', body: fd });
}
```

- [ ] **Step 2: Verify the file compiles with TypeScript**

```bash
cd "C:\Users\MichaelCamachoMercad\OneDrive - INVID\Escritorio\Rental_Vacations\client" && npx tsc --noEmit 2>&1
```

Expected: no errors.

---

## Task 2: Tests for `/api/gear-checkout`

**Files:**
- Create: `client/__tests__/api.gear-checkout.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/gear-checkout/route';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { makeMockSupabase, makeJsonRequest } from './helpers/supabase-mock';

vi.mock('@/lib/supabase/server');
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: { create: vi.fn() },
    },
    refunds: { create: vi.fn() },
  },
}));

const BASE_URL = 'http://localhost/api/gear-checkout';

const VALID_BODY = {
  itemId: 'surfboard',
  startDate: '2026-08-01',
  endDate: '2026-08-04',  // 3 days
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
};

function mockStripeSession(overrides = {}) {
  (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'sess_test123',
    url: 'https://checkout.stripe.com/pay/test123',
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('POST /api/gear-checkout — happy path', () => {
  it('returns 200 with a Stripe checkout URL', async () => {
    const mock = makeMockSupabase();
    // gear-checkout calls from() twice: insert first, then update
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._insertChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    mockStripeSession();

    const res = await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://checkout.stripe.com/pay/test123');
  });

  it('inserts the rental record into Supabase with correct pricing', async () => {
    const mock = makeMockSupabase();
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._insertChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    mockStripeSession();

    await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);

    const insertedRow = mock._insertChain.insert.mock.calls[0][0];
    // surfboard = $35/day × 3 days = $105 rental + $20 deposit = $125 total
    expect(insertedRow.daily_rate_cents).toBe(3500);
    expect(insertedRow.days).toBe(3);
    expect(insertedRow.rental_total_cents).toBe(10500);
    expect(insertedRow.deposit_cents).toBe(2000);
    expect(insertedRow.grand_total_cents).toBe(12500);
    expect(insertedRow.status).toBe('pending');
    expect(insertedRow.item_id).toBe('surfboard');
    expect(insertedRow.item_name).toBe('Surfboard');
    expect(insertedRow.customer_email).toBe('jane@example.com');
    expect(insertedRow.locker_code).toMatch(/^\d{4}$/);
  });

  it('creates a Stripe session with two line items (rental + deposit)', async () => {
    const mock = makeMockSupabase();
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._insertChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    mockStripeSession();

    await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);

    const createCall = (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(createCall.line_items).toHaveLength(2);
    expect(createCall.line_items[0].price_data.unit_amount).toBe(10500); // rental
    expect(createCall.line_items[1].price_data.unit_amount).toBe(2000);  // deposit
    expect(createCall.mode).toBe('payment');
    expect(createCall.success_url).toContain('/gear/success?session_id={CHECKOUT_SESSION_ID}');
    expect(createCall.cancel_url).toContain('/gear');
    expect(createCall.customer_email).toBe('jane@example.com');
  });

  it('saves the stripe session id to the rental record', async () => {
    const mock = makeMockSupabase();
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._insertChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    mockStripeSession({ id: 'sess_unique999' });

    await POST(makeJsonRequest(BASE_URL, VALID_BODY) as never);

    const updateArg = mock._updateChain.update.mock.calls[0][0];
    expect(updateArg.stripe_session_id).toBe('sess_unique999');
  });

  it('calculates correctly for a 1-day bike rental', async () => {
    const mock = makeMockSupabase();
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._insertChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    mockStripeSession();

    await POST(makeJsonRequest(BASE_URL, {
      itemId: 'bike',
      startDate: '2026-08-01',
      endDate: '2026-08-02',
      customerName: 'Joe Test',
      customerEmail: 'joe@test.com',
    }) as never);

    const insertedRow = mock._insertChain.insert.mock.calls[0][0];
    // bike = $20/day × 1 day = $20 rental + $20 deposit = $40 total
    expect(insertedRow.daily_rate_cents).toBe(2000);
    expect(insertedRow.days).toBe(1);
    expect(insertedRow.rental_total_cents).toBe(2000);
    expect(insertedRow.grand_total_cents).toBe(4000);
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
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._insertChain);
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
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:\Users\MichaelCamachoMercad\OneDrive - INVID\Escritorio\Rental_Vacations\client" && npx vitest run __tests__/api.gear-checkout.test.ts --reporter=verbose 2>&1
```

Expected: 13 tests pass. Fix any failures before continuing.

---

## Task 3: Tests for `/api/gear-return`

**Files:**
- Create: `client/__tests__/api.gear-return.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/gear-return/route';
import { createClient } from '@/lib/supabase/server';
import { makeMockSupabase, makeFile, makeFormRequest } from './helpers/supabase-mock';

vi.mock('@/lib/supabase/server');

const BASE_URL = 'http://localhost/api/gear-return';

const ACTIVE_RENTAL = {
  id: 'uuid-001',
  status: 'active',
  rental_id: 'GR-TEST01',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('POST /api/gear-return — happy path', () => {
  function setupSuccessClient() {
    // gear-return calls from() twice: select then update
    // storage.from() is called for each uploaded file
    const mock = makeMockSupabase({
      singleData: ACTIVE_RENTAL,
      storagePublicUrl: 'https://storage.example.com/GR-TEST01/photo.jpg',
    });
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._selectChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    return mock;
  }

  it('returns 200 { ok: true } when photos are uploaded', async () => {
    const mock = setupSuccessClient();
    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('surf.jpg')],
    });

    const res = await POST(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('uploads each photo to the gear-return-photos bucket', async () => {
    const mock = setupSuccessClient();
    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('a.jpg'), makeFile('b.jpg')],
    });

    await POST(req as never);

    expect(mock._storageBucket.upload).toHaveBeenCalledTimes(2);
    const [path1] = mock._storageBucket.upload.mock.calls[0];
    expect(path1).toMatch(/^GR-TEST01\//);
    expect(path1).toMatch(/\.jpg$/);
  });

  it('updates the rental record to status "returned" with photo URLs', async () => {
    const mock = setupSuccessClient();
    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });

    await POST(req as never);

    const updateArg = mock._updateChain.update.mock.calls[0][0];
    expect(updateArg.status).toBe('returned');
    expect(updateArg.return_photo_urls).toEqual([
      'https://storage.example.com/GR-TEST01/photo.jpg',
    ]);
    expect(updateArg.return_submitted_at).toBeTruthy();
  });

  it('handles multiple photos and stores all URLs', async () => {
    const mock = makeMockSupabase({ singleData: ACTIVE_RENTAL });
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._selectChain)
      .mockReturnValueOnce(mock._updateChain);
    // Make each getPublicUrl call return a unique URL
    mock._storageBucket.getPublicUrl
      .mockReturnValueOnce({ data: { publicUrl: 'https://storage.example.com/1.jpg' } })
      .mockReturnValueOnce({ data: { publicUrl: 'https://storage.example.com/2.jpg' } })
      .mockReturnValueOnce({ data: { publicUrl: 'https://storage.example.com/3.jpg' } });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('1.jpg'), makeFile('2.jpg'), makeFile('3.jpg')],
    });

    await POST(req as never);

    const updateArg = mock._updateChain.update.mock.calls[0][0];
    expect(updateArg.return_photo_urls).toHaveLength(3);
    expect(updateArg.return_photo_urls).toContain('https://storage.example.com/2.jpg');
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe('POST /api/gear-return — validation', () => {
  it('returns 400 when rentalId is missing', async () => {
    const req = makeFormRequest(BASE_URL, {
      photos: [makeFile('photo.jpg')],
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing rentalId or photos/i);
  });

  it('returns 400 when no photos are provided', async () => {
    const req = makeFormRequest(BASE_URL, { rentalId: 'GR-TEST01' });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing rentalId or photos/i);
  });

  it('returns 404 when rental does not exist', async () => {
    const mock = makeMockSupabase({ singleData: null });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-NOTEXIST',
      photos: [makeFile('photo.jpg')],
    });

    const res = await POST(req as never);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/rental not found/i);
  });

  it('returns 409 when rental is already returned', async () => {
    const mock = makeMockSupabase({ singleData: { ...ACTIVE_RENTAL, status: 'returned' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });

    const res = await POST(req as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/return already submitted/i);
  });

  it('returns 409 when rental is already completed', async () => {
    const mock = makeMockSupabase({ singleData: { ...ACTIVE_RENTAL, status: 'completed' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });

    const res = await POST(req as never);
    expect(res.status).toBe(409);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe('POST /api/gear-return — error paths', () => {
  it('returns 500 when Supabase Storage upload fails', async () => {
    const mock = makeMockSupabase({
      singleData: ACTIVE_RENTAL,
      storageUploadError: { message: 'Bucket not found' },
    });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });

    const res = await POST(req as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/photo upload failed/i);
  });

  it('returns 500 when Supabase update fails', async () => {
    const mock = makeMockSupabase({
      singleData: ACTIVE_RENTAL,
      updateError: { message: 'Update failed' },
    });
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._selectChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });

    const res = await POST(req as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/could not update rental/i);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:\Users\MichaelCamachoMercad\OneDrive - INVID\Escritorio\Rental_Vacations\client" && npx vitest run __tests__/api.gear-return.test.ts --reporter=verbose 2>&1
```

Expected: 12 tests pass.

---

## Task 4: Tests for `/api/gear-release-deposit`

**Files:**
- Create: `client/__tests__/api.gear-release-deposit.test.ts`

- [ ] **Step 1: Write the test file**

```ts
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('POST /api/gear-release-deposit — happy path', () => {
  function setupSuccessClient() {
    const mock = makeMockSupabase({ singleData: RETURNED_RENTAL });
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._selectChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
    (stripe.refunds.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 're_test456',
    });
    return mock;
  }

  it('returns 200 { ok: true, refundId } on success', async () => {
    setupSuccessClient();
    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.refundId).toBe('re_test456');
  });

  it('calls stripe.refunds.create with the correct payment intent and deposit amount', async () => {
    setupSuccessClient();
    await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);

    expect(stripe.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_test_abc123',
      amount: 2000,
    });
  });

  it('updates the rental record to status "completed"', async () => {
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

  it('uses deposit_cents from the rental record (not hardcoded)', async () => {
    // Use a $50 deposit to verify it is NOT hardcoded to $20
    const rentalWith50Deposit = { ...RETURNED_RENTAL, deposit_cents: 5000 };
    const mock = makeMockSupabase({ singleData: rentalWith50Deposit });
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

  it('returns 409 when deposit is already released (status=completed)', async () => {
    const mock = makeMockSupabase({ singleData: { ...RETURNED_RENTAL, status: 'completed' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const res = await POST(makeJsonRequest(BASE_URL, { rentalId: 'GR-TEST01' }) as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/deposit already released/i);
  });

  it('returns 409 when gear has not been returned yet (status=active)', async () => {
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
  it('returns 500 when Stripe refund fails', async () => {
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
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:\Users\MichaelCamachoMercad\OneDrive - INVID\Escritorio\Rental_Vacations\client" && npx vitest run __tests__/api.gear-release-deposit.test.ts --reporter=verbose 2>&1
```

Expected: 12 tests pass.

---

## Task 5: Tests for `ReturnClient` component

**Files:**
- Create: `client/__tests__/ReturnClient.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReturnClient } from '@/app/gear/return/[rentalId]/ReturnClient';

// CSS modules return empty objects in Vitest (configured via vitest.config.ts)
// URL.createObjectURL is not available in jsdom
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-preview-url');
global.URL.revokeObjectURL = vi.fn();

const DEFAULT_PROPS = {
  rentalId: 'GR-TEST01',
  itemName: 'Surfboard',
  returnSubmitted: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

// ─── Initial state ────────────────────────────────────────────────────────────

describe('ReturnClient — initial state', () => {
  it('shows the item name in instructions', () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    expect(screen.getByText(/Surfboard/)).toBeTruthy();
  });

  it('shows the upload area with instructions', () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    expect(screen.getByText(/Click to add photos/i)).toBeTruthy();
    expect(screen.getByText(/JPG, PNG, HEIC/i)).toBeTruthy();
  });

  it('renders submit button disabled when no files selected', () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    const btn = screen.getByRole('button', { name: /submit return/i });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not show "Return received!" initially', () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    expect(screen.queryByText(/Return received!/i)).toBeNull();
  });
});

// ─── Pre-submitted state ──────────────────────────────────────────────────────

describe('ReturnClient — already submitted', () => {
  it('shows success state immediately when returnSubmitted=true', () => {
    render(<ReturnClient {...DEFAULT_PROPS} returnSubmitted={true} />);
    expect(screen.getByText(/Return received!/i)).toBeTruthy();
    expect(screen.getByText(/48 hours/i)).toBeTruthy();
  });

  it('does not show the upload area when already submitted', () => {
    render(<ReturnClient {...DEFAULT_PROPS} returnSubmitted={true} />);
    expect(screen.queryByText(/Click to add photos/i)).toBeNull();
  });
});

// ─── File selection ───────────────────────────────────────────────────────────

describe('ReturnClient — file selection', () => {
  it('enables the submit button after a file is selected', async () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /submit return/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('shows file count in button label', async () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /1 photo/i })).toBeTruthy();
    });
  });

  it('shows plural "photos" when 2 files selected', async () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const files = [
      new File(['img'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['img'], 'b.jpg', { type: 'image/jpeg' }),
    ];
    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /2 photos/i })).toBeTruthy();
    });
  });

  it('shows image previews after file selection', async () => {
    render(<ReturnClient {...DEFAULT_PROPS} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      const img = document.querySelector('img') as HTMLImageElement;
      expect(img).toBeTruthy();
      expect(img.src).toContain('blob:mock-preview-url');
    });
  });
});

// ─── Submission ───────────────────────────────────────────────────────────────

describe('ReturnClient — submission', () => {
  function addFileAndGetButton() {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    return screen.getByRole('button', { name: /submit return/i });
  }

  it('shows "Uploading..." while request is in progress', async () => {
    let resolvePromise!: (v: unknown) => void;
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(resolve => { resolvePromise = resolve; })
    );

    render(<ReturnClient {...DEFAULT_PROPS} />);
    const btn = addFileAndGetButton();
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /uploading/i })).toBeTruthy();
    });

    // Clean up hanging promise
    resolvePromise({ ok: true, json: async () => ({ ok: true }) });
  });

  it('shows "Return received!" after successful submission', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    render(<ReturnClient {...DEFAULT_PROPS} />);
    const btn = addFileAndGetButton();
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText(/Return received!/i)).toBeTruthy();
    });
  });

  it('POSTs to /api/gear-return with rentalId and photos', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button', { name: /submit return/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/gear-return',
        expect.objectContaining({ method: 'POST' })
      );
    });

    const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = opts.body as FormData;
    expect(body.get('rentalId')).toBe('GR-TEST01');
    expect(body.getAll('photos')).toHaveLength(1);
  });

  it('shows error message when API returns non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Photo upload failed' }),
    });

    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button', { name: /submit return/i }));

    await waitFor(() => {
      expect(screen.getByText(/Photo upload failed/i)).toBeTruthy();
    });
  });

  it('shows generic error when fetch throws', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button', { name: /submit return/i }));

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeTruthy();
    });
  });

  it('re-enables the button after failed submission (not stuck in loading)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    });

    render(<ReturnClient {...DEFAULT_PROPS} />);
    addFileAndGetButton();
    fireEvent.click(screen.getByRole('button', { name: /submit return/i }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /submit return/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Add CSS module mock to vitest.config.ts**

CSS modules (`.module.css`) cannot be imported directly in Vitest. Add a module name mapper. Read the current `client/vitest.config.ts` and add the moduleNameMapper:

```ts
// client/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
  },
});
```

- [ ] **Step 3: Run the ReturnClient tests**

```bash
cd "C:\Users\MichaelCamachoMercad\OneDrive - INVID\Escritorio\Rental_Vacations\client" && npx vitest run __tests__/ReturnClient.test.tsx --reporter=verbose 2>&1
```

Expected: 14 tests pass.

---

## Task 6: Full suite verification

**Files:** none

- [ ] **Step 1: Run the complete test suite**

```bash
cd "C:\Users\MichaelCamachoMercad\OneDrive - INVID\Escritorio\Rental_Vacations\client" && npx vitest run --reporter=verbose 2>&1
```

Expected output:
```
 ✓ __tests__/pricing.test.ts       (6)
 ✓ __tests__/gear.test.ts          (10)
 ✓ __tests__/api.gear-checkout.test.ts       (13)
 ✓ __tests__/api.gear-return.test.ts         (12)
 ✓ __tests__/api.gear-release-deposit.test.ts (12)
 ✓ __tests__/ReturnClient.test.tsx           (14)

Test Files: 6 passed (6)
Tests:      67 passed (67)
```

- [ ] **Step 2: TypeScript check**

```bash
cd "C:\Users\MichaelCamachoMercad\OneDrive - INVID\Escritorio\Rental_Vacations\client" && npx tsc --noEmit 2>&1
```

Expected: No errors.

---

## Self-Review

### 1. Spec Coverage

| Requirement | Task |
|-------------|------|
| gear-checkout: all missing-field validations (5 fields) | Task 2 — 5 individual tests |
| gear-checkout: unknown item ID | Task 2 |
| gear-checkout: 0-day rental and negative days | Task 2 — 2 tests |
| gear-checkout: correct pricing math (surfboard 3d, bike 1d) | Task 2 — 2 tests |
| gear-checkout: 2 Stripe line items (rental + deposit) | Task 2 |
| gear-checkout: Stripe session ID saved to DB | Task 2 |
| gear-checkout: DB insert error → 500 | Task 2 |
| gear-checkout: Stripe throw → 500 | Task 2 |
| gear-return: missing rentalId → 400 | Task 3 |
| gear-return: no photos → 400 | Task 3 |
| gear-return: rental not found → 404 | Task 3 |
| gear-return: already returned → 409 | Task 3 |
| gear-return: already completed → 409 | Task 3 |
| gear-return: storage upload error → 500 | Task 3 |
| gear-return: DB update error → 500 | Task 3 |
| gear-return: photo URLs saved, status=returned | Task 3 |
| gear-return: multiple photos | Task 3 |
| gear-release: missing rentalId → 400 | Task 4 |
| gear-release: not found → 404 | Task 4 |
| gear-release: completed → 409 | Task 4 |
| gear-release: not returned → 409 (active, pending) | Task 4 — 2 tests |
| gear-release: no payment intent → 400 | Task 4 |
| gear-release: Stripe called with correct amount | Task 4 |
| gear-release: deposit_cents not hardcoded | Task 4 |
| gear-release: status=completed, notes contain refund ID | Task 4 |
| gear-release: Stripe error → 500 | Task 4 |
| ReturnClient: shows item name | Task 5 |
| ReturnClient: upload area visible | Task 5 |
| ReturnClient: button disabled with no files | Task 5 |
| ReturnClient: immediate success state if pre-submitted | Task 5 |
| ReturnClient: file count in button label (1 photo / 2 photos) | Task 5 |
| ReturnClient: image previews shown | Task 5 |
| ReturnClient: "Uploading..." during request | Task 5 |
| ReturnClient: "Return received!" on success | Task 5 |
| ReturnClient: correct FormData fields sent | Task 5 |
| ReturnClient: API error message shown | Task 5 |
| ReturnClient: network error shown | Task 5 |
| ReturnClient: button re-enabled after failed submission | Task 5 |

### 2. Placeholder Scan

None found.

### 3. Type Consistency

- `makeMockSupabase` returns `_selectChain`, `_insertChain`, `_updateChain`, `_storageBucket`, `_mockFrom` — all used consistently across Tasks 2–4.
- `makeJsonRequest` returns `Request` cast as `never` when passed to route handlers (avoids NextRequest import complexity).
- `makeFormRequest` builds valid `FormData` — consistent with how `gear-return` reads it via `req.formData()`.
