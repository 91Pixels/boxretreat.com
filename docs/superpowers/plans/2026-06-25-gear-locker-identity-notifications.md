# Gear Locker Identity & Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time locker inventory, identity verification post-payment, Telegram admin validation, confirmation emails via Resend, return reminders via Vercel Cron, and extension/discount management.

**Architecture:** Supabase `lockers` table holds physical lockers per gear type. Customer pays → submits ID → admin replies "Validado" in Telegram → system assigns lowest available locker → sends Resend confirmation email. Availability is checked before payment (UX) and before assignment (race guard). Admin portal gets a new Locker Inventory tab with real-time status + countdown timers.

**Tech Stack:** Next.js 14 App Router · Supabase (Postgres + Storage) · Stripe · Resend · Telegram Bot API (direct fetch) · Vercel Cron

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/002_lockers_and_id.sql` | Create |
| `client/lib/email.ts` | Create — Resend templates |
| `client/lib/telegram.ts` | Create — Telegram API helpers |
| `client/lib/lockers.ts` | Create — availability queries |
| `client/app/api/gear-availability/route.ts` | Create |
| `client/app/api/gear-submit-id/route.ts` | Create |
| `client/app/api/telegram-webhook/route.ts` | Create |
| `client/app/api/gear-send-reminder/route.ts` | Create |
| `client/app/api/gear-extend/route.ts` | Create |
| `client/app/api/gear-checkout/route.ts` | Modify — add availability check, remove generateLockerCode |
| `client/app/gear/success/page.tsx` | Modify — redirect to /gear/verify |
| `client/app/gear/GearRentalClient.tsx` | Modify — availability badge |
| `client/app/gear/verify/[rentalId]/page.tsx` | Create |
| `client/app/gear/verify/[rentalId]/VerifyClient.tsx` | Create |
| `client/app/gear/verify/[rentalId]/verify.module.css` | Create |
| `client/app/gear/extend/[rentalId]/page.tsx` | Create |
| `client/app/gear/extend/[rentalId]/ExtendClient.tsx` | Create |
| `client/app/gear/extend/[rentalId]/extend.module.css` | Create |
| `client/app/admin/page.tsx` | Modify — fetch lockers |
| `client/app/admin/AdminClient.tsx` | Modify — Locker Inventory tab |
| `vercel.json` | Create |
| `client/__tests__/api.gear-availability.test.ts` | Create |
| `client/__tests__/api.gear-submit-id.test.ts` | Create |
| `client/__tests__/api.telegram-webhook.test.ts` | Create |
| `client/__tests__/api.gear-send-reminder.test.ts` | Create |
| `client/__tests__/lib.lockers.test.ts` | Create |

---

## Task 1: SQL Migration + Supabase Storage Bucket

**Files:**
- Create: `supabase/migrations/002_lockers_and_id.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- supabase/migrations/002_lockers_and_id.sql

-- Storage bucket for ID photos
insert into storage.buckets (id, name, public)
values ('id-photos', 'id-photos', true)
on conflict do nothing;

-- Storage policy: allow public read
insert into storage.policies (name, bucket_id, operation, definition)
values (
  'Public read id-photos',
  'id-photos',
  'SELECT',
  'true'
) on conflict do nothing;

-- Lockers table
create table if not exists lockers (
  id            uuid primary key default gen_random_uuid(),
  item_id       text not null,
  locker_number integer not null,
  access_code   text not null,
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz default now(),
  unique(item_id, locker_number)
);

-- Seed lockers
insert into lockers (item_id, locker_number, access_code, description) values
  ('surfboard', 1, '4821', 'Blue locker #1'),
  ('surfboard', 2, '3947', 'Blue locker #2'),
  ('surfboard', 3, '7203', 'Blue locker #3'),
  ('kayak',     1, '5512', 'Green locker #1'),
  ('kayak',     2, '8834', 'Green locker #2'),
  ('snorkel',   1, '2291', 'Yellow locker #1'),
  ('snorkel',   2, '6673', 'Yellow locker #2'),
  ('gopro',     1, '1456', 'Orange locker #1'),
  ('bike',      1, '9908', 'Red locker #1'),
  ('bike',      2, '3321', 'Red locker #2'),
  ('beach-set', 1, '7745', 'White locker #1')
on conflict do nothing;

-- New fields on gear_rentals
alter table gear_rentals add column if not exists id_type text;
alter table gear_rentals add column if not exists id_number text;
alter table gear_rentals add column if not exists id_photo_url text;
alter table gear_rentals add column if not exists locker_id uuid references lockers(id);
alter table gear_rentals add column if not exists locker_access_code text;
alter table gear_rentals add column if not exists validation_status text not null default 'pending_payment';
alter table gear_rentals add column if not exists telegram_message_id bigint;
alter table gear_rentals add column if not exists return_deadline timestamptz;
alter table gear_rentals add column if not exists confirmation_sent_at timestamptz;
alter table gear_rentals add column if not exists reminder_sent_at timestamptz;

-- Extensions table
create table if not exists gear_rental_extensions (
  id                       uuid primary key default gen_random_uuid(),
  rental_id                text not null references gear_rentals(rental_id),
  extension_days           integer not null,
  daily_rate_cents         integer not null,
  discount_amount_cents    integer not null default 0,
  total_cents              integer not null,
  stripe_session_id        text,
  stripe_payment_intent_id text,
  paid_at                  timestamptz,
  created_at               timestamptz default now()
);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Navigate to your Supabase project → SQL Editor → paste the migration → click Run.

Expected: "Success. No rows returned." for each statement.

Verify lockers were seeded:
```sql
select item_id, locker_number, access_code from lockers order by item_id, locker_number;
```
Expected: 11 rows.

---

## Task 2: Utility Libraries

**Files:**
- Create: `client/lib/email.ts`
- Create: `client/lib/telegram.ts`
- Create: `client/lib/lockers.ts`

- [ ] **Step 1: Install resend**

```bash
cd client && npm install resend
```

Expected: `added 1 package`

- [ ] **Step 2: Create `client/lib/email.ts`**

```ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

const FROM = process.env.FROM_EMAIL ?? 'BoxRetreat <noreply@boxretreat.com>';
const ADDRESS = process.env.LOCKER_ADDRESS ?? 'Playa Luquillo, PR 00773';
const DIRECTIONS =
  process.env.LOCKER_DIRECTIONS ??
  'From PR-3, take exit 31 toward Luquillo Beach. Lockers are at the main parking entrance.';

export async function sendConfirmationEmail(opts: {
  to: string;
  customerName: string;
  itemName: string;
  lockerNumber: number;
  accessCode: string;
  startDate: string;
  endDate: string;
  rentalId: string;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your BoxRetreat gear is ready — Locker #${opts.lockerNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <h1>Hi ${opts.customerName} 👋</h1>
        <p>Your <strong>${opts.itemName}</strong> rental is confirmed!</p>
        <div style="background:#f4f4f4;border-radius:8px;padding:24px;margin:24px 0;text-align:center">
          <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px">Locker</p>
          <p style="margin:0;font-size:48px;font-weight:700">#${opts.lockerNumber}</p>
          <p style="margin:12px 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:1px">Access Code</p>
          <p style="margin:0;font-size:36px;font-weight:700;color:#2563eb;letter-spacing:8px">${opts.accessCode}</p>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Gear</td><td><strong>${opts.itemName}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Pickup</td><td><strong>${opts.startDate}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#666">Return by</td><td><strong>${opts.endDate} at 3:00 PM</strong></td></tr>
        </table>
        <h2>📍 Location</h2>
        <p>${ADDRESS}</p>
        <p style="color:#555">${DIRECTIONS}</p>
        <h2>🔄 Returning</h2>
        <p>Place gear back in the locker and submit return photos at:</p>
        <p><a href="${base}/gear/return/${opts.rentalId}">${base}/gear/return/${opts.rentalId}</a></p>
        <p style="color:#888;font-size:13px">Your $20 security deposit will be refunded within 48h after inspection.</p>
      </div>
    `,
  });
}

export async function sendReminderEmail(opts: {
  to: string;
  customerName: string;
  itemName: string;
  rentalId: string;
}) {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `⏰ Return your ${opts.itemName} by 3:00 PM today`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <h1 style="color:#dc2626">⏰ Return Reminder</h1>
        <p>Hi ${opts.customerName},</p>
        <p>Your <strong>${opts.itemName}</strong> rental ends <strong>today at 3:00 PM</strong>.</p>
        <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:20px;margin:24px 0;text-align:center">
          <p style="margin:0;font-size:20px;font-weight:700;color:#dc2626">Return deadline: 3:00 PM today</p>
        </div>
        <p>Submit return photos at: <a href="${base}/gear/return/${opts.rentalId}">${base}/gear/return/${opts.rentalId}</a></p>
        <p>Need more time? <a href="${base}/gear/extend/${opts.rentalId}">Extend your rental →</a></p>
      </div>
    `,
  });
}

export async function sendExtensionPaymentEmail(opts: {
  to: string;
  customerName: string;
  itemName: string;
  extensionDays: number;
  totalCents: number;
  stripeUrl: string;
}) {
  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: `BoxRetreat: Pay to extend your ${opts.itemName} rental`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <h1>Rental Extension</h1>
        <p>Hi ${opts.customerName},</p>
        <p>Your extension request for <strong>${opts.itemName}</strong> (${opts.extensionDays} extra days) is ready.</p>
        <p><strong>Amount: $${(opts.totalCents / 100).toFixed(2)}</strong></p>
        <p style="margin-top:24px">
          <a href="${opts.stripeUrl}" style="background:#111;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;display:inline-block">
            Pay Now →
          </a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:16px">Link expires in 24 hours.</p>
      </div>
    `,
  });
}
```

- [ ] **Step 3: Create `client/lib/telegram.ts`**

```ts
const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string): Promise<number> {
  const res = await fetch(`${API()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage: ${data.description}`);
  return data.result.message_id as number;
}

export async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  caption: string
): Promise<number> {
  const res = await fetch(`${API()}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' }),
  });
  const data = await res.json();
  if (!data.ok) {
    // Fallback to text-only if photo fails (e.g. URL not publicly accessible)
    return sendTelegramMessage(chatId, caption + '\n\n📎 Photo: ' + photoUrl);
  }
  return data.result.message_id as number;
}

export async function replyTelegramMessage(
  chatId: string,
  replyToMessageId: number,
  text: string
): Promise<void> {
  await fetch(`${API()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: replyToMessageId }),
  });
}
```

- [ ] **Step 4: Create `client/lib/lockers.ts`**

```ts
import { createClient } from '@/lib/supabase/server';

export interface LockerRow {
  id: string;
  item_id: string;
  locker_number: number;
  access_code: string;
  description: string | null;
  is_active: boolean;
}

export async function findAvailableLocker(
  itemId: string,
  startDate: string,
  endDate: string
): Promise<LockerRow | null> {
  const supabase = await createClient();

  const { data: allLockers } = await supabase
    .from('lockers')
    .select('*')
    .eq('item_id', itemId)
    .eq('is_active', true)
    .order('locker_number', { ascending: true });

  if (!allLockers || allLockers.length === 0) return null;

  const { data: booked } = await supabase
    .from('gear_rentals')
    .select('locker_id')
    .not('locker_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  const bookedIds = new Set((booked ?? []).map(r => r.locker_id));
  return (allLockers as LockerRow[]).find(l => !bookedIds.has(l.id)) ?? null;
}

export async function countAvailableLockers(
  itemId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = await createClient();

  const { data: allLockers } = await supabase
    .from('lockers')
    .select('id')
    .eq('item_id', itemId)
    .eq('is_active', true);

  if (!allLockers || allLockers.length === 0) return 0;

  const { data: booked } = await supabase
    .from('gear_rentals')
    .select('locker_id')
    .not('locker_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  const bookedIds = new Set((booked ?? []).map(r => r.locker_id));
  return allLockers.filter(l => !bookedIds.has(l.id)).length;
}

export interface LockerInventoryItem {
  locker: LockerRow;
  status: 'available' | 'reserved' | 'occupied';
  rental: {
    rental_id: string;
    customer_name: string;
    start_date: string;
    end_date: string;
    return_deadline: string | null;
  } | null;
}

export async function getLockerInventory(): Promise<LockerInventoryItem[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: lockers } = await supabase
    .from('lockers')
    .select('*')
    .eq('is_active', true)
    .order('item_id')
    .order('locker_number');

  if (!lockers) return [];

  const { data: activeRentals } = await supabase
    .from('gear_rentals')
    .select('rental_id, customer_name, start_date, end_date, return_deadline, locker_id')
    .not('locker_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .neq('validation_status', 'pending_payment')
    .neq('validation_status', 'pending_id');

  const rentalByLockerId = new Map(
    (activeRentals ?? []).map(r => [r.locker_id, r])
  );

  return (lockers as LockerRow[]).map(locker => {
    const rental = rentalByLockerId.get(locker.id) ?? null;
    let status: LockerInventoryItem['status'] = 'available';
    if (rental) {
      status = rental.start_date <= today && rental.end_date >= today ? 'occupied' : 'reserved';
    }
    return { locker, status, rental };
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add client/lib/email.ts client/lib/telegram.ts client/lib/lockers.ts
git commit -m "feat: add email, telegram, and locker utility libs"
```

---

## Task 3: Gear Availability API

**Files:**
- Create: `client/app/api/gear-availability/route.ts`
- Create: `client/__tests__/lib.lockers.test.ts`

- [ ] **Step 1: Write test first**

```ts
// client/__tests__/lib.lockers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

function makeChain(returnData: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const methods = ['select','eq','neq','not','lte','gte','order','is'];
  methods.forEach(m => { chain[m] = vi.fn(() => chain); });
  chain['data'] = returnData;
  chain['error'] = error;
  return chain;
}

describe('countAvailableLockers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 0 when no lockers exist for item', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'lockers') return makeChain([]);
      return makeChain([]);
    });
    const { countAvailableLockers } = await import('@/lib/lockers');
    const count = await countAvailableLockers('unicorn', '2026-08-01', '2026-08-05');
    expect(count).toBe(0);
  });

  it('returns total locker count when none are booked', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'lockers') return makeChain([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      return makeChain([]);
    });
    const { countAvailableLockers } = await import('@/lib/lockers');
    const count = await countAvailableLockers('surfboard', '2026-08-01', '2026-08-05');
    expect(count).toBe(3);
  });

  it('subtracts booked lockers', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'lockers') return makeChain([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      return makeChain([{ locker_id: 'a' }, { locker_id: 'b' }]);
    });
    const { countAvailableLockers } = await import('@/lib/lockers');
    const count = await countAvailableLockers('surfboard', '2026-08-01', '2026-08-05');
    expect(count).toBe(1);
  });
});

describe('findAvailableLocker', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when all lockers booked', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'lockers') return makeChain([{ id: 'a', locker_number: 1 }]);
      return makeChain([{ locker_id: 'a' }]);
    });
    const { findAvailableLocker } = await import('@/lib/lockers');
    const result = await findAvailableLocker('surfboard', '2026-08-01', '2026-08-05');
    expect(result).toBeNull();
  });

  it('returns lowest numbered available locker', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'lockers') return makeChain([
        { id: 'a', locker_number: 1 },
        { id: 'b', locker_number: 2 },
      ]);
      return makeChain([{ locker_id: 'a' }]);
    });
    const { findAvailableLocker } = await import('@/lib/lockers');
    const result = await findAvailableLocker('surfboard', '2026-08-01', '2026-08-05');
    expect(result?.id).toBe('b');
    expect(result?.locker_number).toBe(2);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL — module not found)**

```bash
cd client && npx vitest run __tests__/lib.lockers.test.ts
```

Expected: FAIL or PASS (the mock may make it pass immediately once lib exists).

- [ ] **Step 3: Create `client/app/api/gear-availability/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { countAvailableLockers } from '@/lib/lockers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('itemId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!itemId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing itemId, startDate, or endDate' }, { status: 400 });
  }

  try {
    const count = await countAvailableLockers(itemId, startDate, endDate);
    return NextResponse.json({ available: count > 0, count });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Write API test**

```ts
// client/__tests__/api.gear-availability.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/gear-availability/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/lockers', () => ({
  countAvailableLockers: vi.fn(),
}));

import { countAvailableLockers } from '@/lib/lockers';
const mockCount = vi.mocked(countAvailableLockers);

function makeReq(params: Record<string, string>) {
  const url = new URL('http://localhost/api/gear-availability');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

describe('GET /api/gear-availability', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when params missing', async () => {
    const res = await GET(makeReq({ itemId: 'surfboard' }));
    expect(res.status).toBe(400);
  });

  it('returns available:true when count > 0', async () => {
    mockCount.mockResolvedValue(2);
    const res = await GET(makeReq({ itemId: 'surfboard', startDate: '2026-08-01', endDate: '2026-08-05' }));
    const body = await res.json();
    expect(body).toEqual({ available: true, count: 2 });
  });

  it('returns available:false when count is 0', async () => {
    mockCount.mockResolvedValue(0);
    const res = await GET(makeReq({ itemId: 'surfboard', startDate: '2026-08-01', endDate: '2026-08-05' }));
    const body = await res.json();
    expect(body).toEqual({ available: false, count: 0 });
  });

  it('returns 500 on error', async () => {
    mockCount.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq({ itemId: 'surfboard', startDate: '2026-08-01', endDate: '2026-08-05' }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd client && npx vitest run __tests__/api.gear-availability.test.ts __tests__/lib.lockers.test.ts
```

Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add client/app/api/gear-availability client/__tests__/api.gear-availability.test.ts client/__tests__/lib.lockers.test.ts
git commit -m "feat: gear availability API + locker utility + tests"
```

---

## Task 4: Update gear-checkout — availability check + remove lockerCode

**Files:**
- Modify: `client/app/api/gear-checkout/route.ts`

- [ ] **Step 1: Replace the file content**

Key changes:
1. Import `countAvailableLockers` from `@/lib/lockers`
2. After validating dates, check availability → return 409 if none
3. Remove `generateLockerCode()` call and `locker_code` field from insert
4. Add `validation_status: 'pending_payment'` and `return_deadline` to insert

```ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { getGearItem } from '@/lib/gear';
import { daysBetween } from '@/lib/locker';
import { countAvailableLockers } from '@/lib/lockers';

const DEPOSIT_CENTS = 2000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, startDate, endDate, customerName, customerEmail } = body;

    if (!itemId || !startDate || !endDate || !customerName || !customerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const item = getGearItem(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Unknown gear item' }, { status: 400 });
    }

    const days = daysBetween(startDate, endDate);
    if (days < 1) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    // Availability guard — must happen before payment
    const available = await countAvailableLockers(itemId, startDate, endDate);
    if (available === 0) {
      return NextResponse.json(
        { error: 'No lockers available for these dates' },
        { status: 409 }
      );
    }

    const dailyRateCents = item.pricePerDay * 100;
    const rentalTotalCents = dailyRateCents * days;
    const grandTotalCents = rentalTotalCents + DEPOSIT_CENTS;
    const rentalId = `GR-${Date.now().toString(36).toUpperCase()}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';

    // return_deadline = end_date at 15:00 Puerto Rico (UTC-4 = 19:00 UTC)
    const returnDeadline = new Date(`${endDate}T19:00:00Z`).toISOString();

    const supabase = await createClient();
    const { error: dbError } = await supabase.from('gear_rentals').insert({
      rental_id: rentalId,
      item_id: itemId,
      item_name: item.name,
      customer_email: customerEmail,
      customer_name: customerName,
      start_date: startDate,
      end_date: endDate,
      days,
      daily_rate_cents: dailyRateCents,
      deposit_cents: DEPOSIT_CENTS,
      rental_total_cents: rentalTotalCents,
      grand_total_cents: grandTotalCents,
      status: 'pending',
      validation_status: 'pending_payment',
      return_deadline: returnDeadline,
    });

    if (dbError) {
      console.error('DB insert error:', dbError);
      return NextResponse.json({ error: 'Could not create rental record' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${item.name} rental · ${days} ${days === 1 ? 'day' : 'days'}`,
              description: `${startDate} → ${endDate}`,
            },
            unit_amount: rentalTotalCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Security deposit (refundable within 48h)',
              description: 'Returned automatically after gear inspection.',
            },
            unit_amount: DEPOSIT_CENTS,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/gear/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/gear`,
      metadata: { rentalId },
    });

    await supabase
      .from('gear_rentals')
      .update({ stripe_session_id: session.id })
      .eq('rental_id', rentalId);

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    console.error('Gear checkout error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/app/api/gear-checkout/route.ts
git commit -m "feat: add availability check to gear-checkout, remove legacy lockerCode"
```

---

## Task 5: Update gear/success — redirect to /gear/verify

**Files:**
- Modify: `client/app/gear/success/page.tsx`

- [ ] **Step 1: Replace file**

After confirming payment, set `validation_status='pending_id'` and redirect to verify page.

```tsx
import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

interface Props {
  searchParams: { session_id?: string };
}

export default async function GearSuccessPage({ searchParams }: Props) {
  const sessionId = searchParams.session_id;
  if (!sessionId) redirect('/gear');

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') redirect('/gear');

    const supabase = await createClient();
    const rentalId = session.metadata?.rentalId;

    if (!rentalId) redirect('/gear');

    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('rental_id, validation_status')
      .eq('rental_id', rentalId)
      .single();

    if (!rental) redirect('/gear');

    if (rental.validation_status === 'pending_payment') {
      await supabase
        .from('gear_rentals')
        .update({
          status: 'active',
          stripe_payment_intent_id: session.payment_intent as string,
          validation_status: 'pending_id',
          updated_at: new Date().toISOString(),
        })
        .eq('rental_id', rentalId);
    }

    redirect(`/gear/verify/${rentalId}`);
  } catch (e) {
    console.error('Gear success error:', e);
    redirect('/gear');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/app/gear/success/page.tsx
git commit -m "feat: redirect success page to ID verification"
```

---

## Task 6: Identity Verification Page

**Files:**
- Create: `client/app/gear/verify/[rentalId]/page.tsx`
- Create: `client/app/gear/verify/[rentalId]/VerifyClient.tsx`
- Create: `client/app/gear/verify/[rentalId]/verify.module.css`

- [ ] **Step 1: Create `page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { VerifyClient } from './VerifyClient';

export const metadata = { title: 'Verify Your Identity — BoxRetreat' };

export default async function VerifyPage({ params }: { params: { rentalId: string } }) {
  const supabase = await createClient();
  const { data: rental } = await supabase
    .from('gear_rentals')
    .select('rental_id, item_name, customer_name, validation_status')
    .eq('rental_id', params.rentalId)
    .single();

  if (!rental) return notFound();

  return (
    <>
      <Nav />
      <VerifyClient
        rentalId={rental.rental_id}
        itemName={rental.item_name}
        alreadySubmitted={
          rental.validation_status === 'id_submitted' ||
          rental.validation_status === 'validated' ||
          rental.validation_status === 'confirmed'
        }
      />
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Create `VerifyClient.tsx`**

```tsx
'use client';
import { useState } from 'react';
import styles from './verify.module.css';

const ID_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'driver_license', label: "Driver's License" },
  { value: 'cedula', label: 'Cédula de Identidad' },
  { value: 'other', label: 'Other Government ID' },
];

interface Props {
  rentalId: string;
  itemName: string;
  alreadySubmitted: boolean;
}

export function VerifyClient({ rentalId, itemName, alreadySubmitted }: Props) {
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit() {
    if (!idType || !idNumber.trim() || !photo) {
      setError('Please fill all fields and upload your ID photo.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('rentalId', rentalId);
      fd.append('idType', idType);
      fd.append('idNumber', idNumber.trim());
      fd.append('photo', photo);
      const res = await fetch('/api/gear-submit-id', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>🔐</div>
          <h1 className={styles.title}>ID Submitted!</h1>
          <p className={styles.sub}>
            We&apos;re reviewing your identity. You&apos;ll receive an email with your locker
            number and access code within a few minutes.
          </p>
          <p className={styles.rentalId}>Rental ID: <code>{rentalId}</code></p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Verify Your Identity</h1>
        <p className={styles.sub}>
          To complete your <strong>{itemName}</strong> rental, please provide a valid
          government-issued ID.
        </p>

        <div className={styles.field}>
          <label className={styles.label}>ID Type</label>
          <select
            className={styles.select}
            value={idType}
            onChange={e => setIdType(e.target.value)}
          >
            <option value="">Select ID type…</option>
            {ID_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ID Number</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Enter your ID number"
            value={idNumber}
            onChange={e => setIdNumber(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>ID Photo</label>
          <input
            className={styles.fileInput}
            type="file"
            accept="image/*"
            onChange={handlePhoto}
          />
          {preview && (
            <img src={preview} alt="ID preview" className={styles.preview} />
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.btn}
          onClick={handleSubmit}
          disabled={loading || !idType || !idNumber || !photo}
        >
          {loading ? 'Submitting…' : 'Submit ID & Continue'}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `verify.module.css`**

```css
.wrap {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  background: var(--br-deep, #0a0a0a);
}

.card {
  background: var(--br-surface, #141414);
  border: 1px solid var(--br-mid, #2a2a2a);
  border-radius: 12px;
  padding: 48px;
  max-width: 480px;
  width: 100%;
}

.iconWrap {
  font-size: 48px;
  margin-bottom: 16px;
  text-align: center;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: var(--br-text, #f5f5f5);
  margin: 0 0 12px;
}

.sub {
  font-size: 15px;
  color: var(--gray-70, #777);
  margin: 0 0 32px;
  line-height: 1.6;
}

.rentalId {
  font-size: 13px;
  color: var(--gray-50, #555);
  margin-top: 24px;
  text-align: center;
}

.field {
  margin-bottom: 20px;
}

.label {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gray-70, #777);
  margin-bottom: 8px;
}

.input, .select {
  width: 100%;
  background: var(--br-deep, #0a0a0a);
  border: 1px solid var(--br-mid, #2a2a2a);
  border-radius: 8px;
  padding: 12px 14px;
  color: var(--br-text, #f5f5f5);
  font-size: 15px;
}

.select option {
  background: #1a1a1a;
}

.fileInput {
  display: block;
  color: var(--gray-70, #777);
  font-size: 14px;
  margin-bottom: 12px;
}

.preview {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--br-mid, #2a2a2a);
}

.error {
  color: #ef4444;
  font-size: 14px;
  margin-bottom: 16px;
}

.btn {
  width: 100%;
  padding: 14px;
  background: var(--br-accent, #2563eb);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Commit**

```bash
git add client/app/gear/verify
git commit -m "feat: add ID verification page"
```

---

## Task 7: Submit ID API

**Files:**
- Create: `client/app/api/gear-submit-id/route.ts`
- Create: `client/__tests__/api.gear-submit-id.test.ts`

- [ ] **Step 1: Create route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramPhoto, sendTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rentalId = formData.get('rentalId') as string | null;
    const idType = formData.get('idType') as string | null;
    const idNumber = formData.get('idNumber') as string | null;
    const photo = formData.get('photo') as File | null;

    if (!rentalId || !idType || !idNumber || !photo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('rental_id, item_name, customer_name, customer_email, start_date, end_date, item_id, validation_status')
      .eq('rental_id', rentalId)
      .single();

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }
    if (rental.validation_status !== 'pending_id') {
      return NextResponse.json({ error: 'ID already submitted or invalid state' }, { status: 409 });
    }

    // Upload photo to Supabase Storage
    const ext = photo.name.split('.').pop() ?? 'jpg';
    const path = `${rentalId}/id-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from('id-photos')
      .upload(path, buffer, { contentType: photo.type, upsert: false });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('id-photos').getPublicUrl(path);
    const idPhotoUrl = urlData.publicUrl;

    // Update rental with ID info
    await supabase.from('gear_rentals').update({
      id_type: idType,
      id_number: idNumber,
      id_photo_url: idPhotoUrl,
      validation_status: 'id_submitted',
      updated_at: new Date().toISOString(),
    }).eq('rental_id', rentalId);

    // Send Telegram notification to admin
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID!;
    const caption =
      `🆔 <b>ID Verification Required</b>\n\n` +
      `📋 Rental: <code>${rentalId}</code>\n` +
      `👤 Customer: ${rental.customer_name}\n` +
      `📧 Email: ${rental.customer_email}\n` +
      `🏄 Gear: ${rental.item_name}\n` +
      `📅 Dates: ${rental.start_date} → ${rental.end_date}\n\n` +
      `🪪 ID Type: ${idType}\n` +
      `🔢 ID Number: ${idNumber}\n\n` +
      `Reply <b>"Validado"</b> to this message to approve and send locker code.`;

    let messageId: number;
    try {
      messageId = await sendTelegramPhoto(adminChatId, idPhotoUrl, caption);
    } catch (telegramErr) {
      console.error('Telegram error:', telegramErr);
      messageId = await sendTelegramMessage(adminChatId, caption);
    }

    // Store telegram_message_id for webhook matching
    await supabase.from('gear_rentals').update({
      telegram_message_id: messageId,
    }).eq('rental_id', rentalId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('Submit ID error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create test**

```ts
// client/__tests__/api.gear-submit-id.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/gear-submit-id/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/telegram', () => ({
  sendTelegramPhoto: vi.fn().mockResolvedValue(42),
  sendTelegramMessage: vi.fn().mockResolvedValue(42),
}));

import { createClient } from '@/lib/supabase/server';
const mockCreateClient = vi.mocked(createClient);

function makeSupabase(rental: unknown, uploadError: unknown = null) {
  const storage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: uploadError }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/photo.jpg' } }),
    }),
  };
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: rental, error: null }),
        update: vi.fn().mockReturnThis(),
      };
      return chain;
    }),
    storage,
  };
}

function makeFormData(fields: Record<string, string | File>) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

describe('POST /api/gear-submit-id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_ADMIN_CHAT_ID = '12345';
  });

  it('returns 400 when fields missing', async () => {
    const req = new NextRequest('http://localhost/api/gear-submit-id', {
      method: 'POST',
      body: makeFormData({ rentalId: 'GR-001' }),
    });
    const supabase = makeSupabase(null);
    mockCreateClient.mockResolvedValue(supabase as never);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when rental not found', async () => {
    const supabase = makeSupabase(null);
    mockCreateClient.mockResolvedValue(supabase as never);
    const fd = makeFormData({
      rentalId: 'GR-MISSING',
      idType: 'passport',
      idNumber: 'P123456',
      photo: new File(['bytes'], 'id.jpg', { type: 'image/jpeg' }),
    });
    const req = new NextRequest('http://localhost/api/gear-submit-id', { method: 'POST', body: fd });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 409 when ID already submitted', async () => {
    const supabase = makeSupabase({ rental_id: 'GR-001', validation_status: 'id_submitted' });
    mockCreateClient.mockResolvedValue(supabase as never);
    const fd = makeFormData({
      rentalId: 'GR-001',
      idType: 'passport',
      idNumber: 'P123',
      photo: new File(['x'], 'id.jpg', { type: 'image/jpeg' }),
    });
    const req = new NextRequest('http://localhost/api/gear-submit-id', { method: 'POST', body: fd });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('returns ok:true on success', async () => {
    const rental = {
      rental_id: 'GR-001',
      item_name: 'Surfboard',
      customer_name: 'Jane',
      customer_email: 'jane@test.com',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      item_id: 'surfboard',
      validation_status: 'pending_id',
    };
    const supabase = makeSupabase(rental);
    mockCreateClient.mockResolvedValue(supabase as never);
    const fd = makeFormData({
      rentalId: 'GR-001',
      idType: 'passport',
      idNumber: 'P123',
      photo: new File(['x'], 'id.jpg', { type: 'image/jpeg' }),
    });
    const req = new NextRequest('http://localhost/api/gear-submit-id', { method: 'POST', body: fd });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd client && npx vitest run __tests__/api.gear-submit-id.test.ts
```

Expected: 4 PASS.

- [ ] **Step 4: Commit**

```bash
git add client/app/api/gear-submit-id client/__tests__/api.gear-submit-id.test.ts
git commit -m "feat: add gear-submit-id API + tests"
```

---

## Task 8: Telegram Webhook

**Files:**
- Create: `client/app/api/telegram-webhook/route.ts`
- Create: `client/__tests__/api.telegram-webhook.test.ts`

- [ ] **Step 1: Create route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findAvailableLocker } from '@/lib/lockers';
import { sendConfirmationEmail } from '@/lib/email';
import { replyTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const text: string = (message?.text ?? '').trim();
    const chatId = String(message?.chat?.id ?? '');
    const messageId: number = message?.message_id;
    const replyToMessageId: number | undefined = message?.reply_to_message?.message_id;

    if (!text.toLowerCase().startsWith('validado')) {
      return NextResponse.json({ ok: true });
    }

    if (!replyToMessageId) {
      await replyTelegramMessage(chatId, messageId, '⚠️ Please reply directly to the ID verification message.');
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();
    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('*')
      .eq('telegram_message_id', replyToMessageId)
      .single();

    if (!rental) {
      await replyTelegramMessage(chatId, messageId, '❌ Rental not found for this message.');
      return NextResponse.json({ ok: true });
    }

    if (rental.validation_status === 'validated' || rental.validation_status === 'confirmed') {
      await replyTelegramMessage(chatId, messageId, `ℹ️ Already validated. Locker #${rental.locker_number ?? '?'} was assigned.`);
      return NextResponse.json({ ok: true });
    }

    // Race-condition guard: check availability again
    const locker = await findAvailableLocker(rental.item_id, rental.start_date, rental.end_date);
    if (!locker) {
      await replyTelegramMessage(chatId, messageId, `❌ No lockers available for ${rental.item_name} on ${rental.start_date}–${rental.end_date}!`);
      return NextResponse.json({ ok: true });
    }

    const returnDeadline = new Date(`${rental.end_date}T19:00:00Z`).toISOString();

    await supabase.from('gear_rentals').update({
      validation_status: 'validated',
      locker_id: locker.id,
      locker_access_code: locker.access_code,
      return_deadline: returnDeadline,
      updated_at: new Date().toISOString(),
    }).eq('rental_id', rental.rental_id);

    await sendConfirmationEmail({
      to: rental.customer_email,
      customerName: rental.customer_name,
      itemName: rental.item_name,
      lockerNumber: locker.locker_number,
      accessCode: locker.access_code,
      startDate: rental.start_date,
      endDate: rental.end_date,
      rentalId: rental.rental_id,
    });

    await supabase.from('gear_rentals').update({
      validation_status: 'confirmed',
      confirmation_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('rental_id', rental.rental_id);

    await replyTelegramMessage(
      chatId,
      messageId,
      `✅ Validated!\nLocker #${locker.locker_number} (code: ${locker.access_code}) assigned.\nConfirmation email sent to ${rental.customer_email}.`
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('Telegram webhook error:', e);
    return NextResponse.json({ ok: true }); // Always 200 to Telegram
  }
}
```

- [ ] **Step 2: Create test**

```ts
// client/__tests__/api.telegram-webhook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/telegram-webhook/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/lockers', () => ({ findAvailableLocker: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendConfirmationEmail: vi.fn() }));
vi.mock('@/lib/telegram', () => ({ replyTelegramMessage: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { findAvailableLocker } from '@/lib/lockers';
import { sendConfirmationEmail } from '@/lib/email';
import { replyTelegramMessage } from '@/lib/telegram';

const mockCreateClient = vi.mocked(createClient);
const mockFindLocker = vi.mocked(findAvailableLocker);
const mockSendEmail = vi.mocked(sendConfirmationEmail);
const mockReply = vi.mocked(replyTelegramMessage);

function makeBody(text: string, replyToId?: number) {
  return {
    message: {
      message_id: 999,
      chat: { id: 12345 },
      text,
      ...(replyToId ? { reply_to_message: { message_id: replyToId } } : {}),
    },
  };
}

function makeChain(data: unknown) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data, error: null }),
      update: vi.fn().mockReturnThis(),
    }),
  };
}

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/telegram-webhook', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('ignores non-Validado messages', async () => {
    mockCreateClient.mockResolvedValue(makeChain(null) as never);
    const res = await POST(makeReq(makeBody('Hello world')));
    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('replies with warning when no reply_to', async () => {
    mockCreateClient.mockResolvedValue(makeChain(null) as never);
    const res = await POST(makeReq(makeBody('Validado')));
    expect(res.status).toBe(200);
    expect(mockReply).toHaveBeenCalledWith('12345', 999, expect.stringContaining('reply directly'));
  });

  it('replies error when rental not found', async () => {
    mockCreateClient.mockResolvedValue(makeChain(null) as never);
    const res = await POST(makeReq(makeBody('Validado', 777)));
    expect(res.status).toBe(200);
    expect(mockReply).toHaveBeenCalledWith('12345', 999, expect.stringContaining('not found'));
  });

  it('assigns locker and sends email on valid Validado', async () => {
    const rental = {
      rental_id: 'GR-001',
      item_id: 'surfboard',
      item_name: 'Surfboard',
      customer_name: 'Jane',
      customer_email: 'jane@test.com',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      validation_status: 'id_submitted',
    };
    mockCreateClient.mockResolvedValue(makeChain(rental) as never);
    mockFindLocker.mockResolvedValue({ id: 'lock-1', locker_number: 2, access_code: '4821', item_id: 'surfboard', description: null, is_active: true });
    mockSendEmail.mockResolvedValue({ id: 'email-1', data: null, error: null } as never);

    const res = await POST(makeReq(makeBody('validado', 42)));
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'jane@test.com',
      lockerNumber: 2,
      accessCode: '4821',
    }));
  });

  it('replies no-locker when all occupied', async () => {
    const rental = {
      rental_id: 'GR-001',
      item_id: 'surfboard',
      item_name: 'Surfboard',
      customer_name: 'Jane',
      customer_email: 'jane@test.com',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      validation_status: 'id_submitted',
    };
    mockCreateClient.mockResolvedValue(makeChain(rental) as never);
    mockFindLocker.mockResolvedValue(null);

    const res = await POST(makeReq(makeBody('Validado', 42)));
    expect(res.status).toBe(200);
    expect(mockReply).toHaveBeenCalledWith('12345', 999, expect.stringContaining('No lockers'));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd client && npx vitest run __tests__/api.telegram-webhook.test.ts
```

Expected: 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add client/app/api/telegram-webhook client/__tests__/api.telegram-webhook.test.ts
git commit -m "feat: telegram webhook for admin validation + tests"
```

---

## Task 9: Return Reminder Cron + vercel.json

**Files:**
- Create: `client/app/api/gear-send-reminder/route.ts`
- Create: `vercel.json`
- Create: `client/__tests__/api.gear-send-reminder.test.ts`

- [ ] **Step 1: Create reminder route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendReminderEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  // Cron secret check (Vercel sets Authorization header for cron jobs)
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: rentals } = await supabase
      .from('gear_rentals')
      .select('rental_id, customer_email, customer_name, item_name')
      .eq('status', 'active')
      .eq('validation_status', 'confirmed')
      .is('reminder_sent_at', null)
      .eq('end_date', today);

    if (!rentals || rentals.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No reminders needed' });
    }

    let sent = 0;
    for (const rental of rentals) {
      try {
        await sendReminderEmail({
          to: rental.customer_email,
          customerName: rental.customer_name,
          itemName: rental.item_name,
          rentalId: rental.rental_id,
        });
        await supabase
          .from('gear_rentals')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('rental_id', rental.rental_id);
        sent++;
      } catch (e) {
        console.error(`Reminder failed for ${rental.rental_id}:`, e);
      }
    }

    return NextResponse.json({ sent, total: rentals.length });
  } catch (e: unknown) {
    console.error('Reminder cron error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create `vercel.json` at project root**

```json
{
  "crons": [
    {
      "path": "/api/gear-send-reminder",
      "schedule": "0 16 * * *"
    }
  ]
}
```

`0 16 * * *` = 16:00 UTC = 12:00 PM Puerto Rico (UTC-4)

- [ ] **Step 3: Create test**

```ts
// client/__tests__/api.gear-send-reminder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/gear-send-reminder/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendReminderEmail: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { sendReminderEmail } from '@/lib/email';

const mockCreateClient = vi.mocked(createClient);
const mockSendReminder = vi.mocked(sendReminderEmail);

function makeSupabase(rentals: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      data: rentals,
      single: vi.fn().mockResolvedValue({ data: rentals[0] ?? null }),
    }),
  };
}

// Proper chain that resolves
function makeSupabaseWithQuery(rentals: unknown[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ data: rentals, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  };
  return { from: vi.fn().mockReturnValue(chain) };
}

function makeReq() {
  return new NextRequest('http://localhost/api/gear-send-reminder');
}

describe('GET /api/gear-send-reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
  });

  it('returns sent:0 when no rentals due', async () => {
    const supabase = makeSupabaseWithQuery([]);
    mockCreateClient.mockResolvedValue(supabase as never);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.sent).toBe(0);
  });

  it('sends emails for each rental due today', async () => {
    const rentals = [
      { rental_id: 'GR-001', customer_email: 'a@test.com', customer_name: 'Alice', item_name: 'Surfboard' },
      { rental_id: 'GR-002', customer_email: 'b@test.com', customer_name: 'Bob', item_name: 'Kayak' },
    ];
    const supabase = makeSupabaseWithQuery(rentals);
    mockCreateClient.mockResolvedValue(supabase as never);
    mockSendReminder.mockResolvedValue({ id: 'ok', data: null, error: null } as never);

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(mockSendReminder).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd client && npx vitest run __tests__/api.gear-send-reminder.test.ts
```

Expected: PASS (or SKIP if mock chain format needs tweaking — adjust mock to match actual Supabase chain).

- [ ] **Step 5: Commit**

```bash
git add client/app/api/gear-send-reminder vercel.json client/__tests__/api.gear-send-reminder.test.ts
git commit -m "feat: gear-send-reminder cron + vercel.json + tests"
```

---

## Task 10: Extension Pages + API

**Files:**
- Create: `client/app/gear/extend/[rentalId]/page.tsx`
- Create: `client/app/gear/extend/[rentalId]/ExtendClient.tsx`
- Create: `client/app/gear/extend/[rentalId]/extend.module.css`
- Create: `client/app/api/gear-extend/route.ts`

- [ ] **Step 1: Create extension page**

```tsx
// client/app/gear/extend/[rentalId]/page.tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { ExtendClient } from './ExtendClient';

export const metadata = { title: 'Extend Your Rental — BoxRetreat' };

export default async function ExtendPage({ params }: { params: { rentalId: string } }) {
  const supabase = await createClient();
  const { data: rental } = await supabase
    .from('gear_rentals')
    .select('rental_id, item_name, customer_name, end_date, daily_rate_cents, return_deadline')
    .eq('rental_id', params.rentalId)
    .eq('status', 'active')
    .single();

  if (!rental) return notFound();

  return (
    <>
      <Nav />
      <ExtendClient
        rentalId={rental.rental_id}
        itemName={rental.item_name}
        currentEndDate={rental.end_date}
        dailyRateCents={rental.daily_rate_cents}
      />
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Create `ExtendClient.tsx`**

```tsx
'use client';
import { useState } from 'react';
import styles from './extend.module.css';

interface Props {
  rentalId: string;
  itemName: string;
  currentEndDate: string;
  dailyRateCents: number;
}

export function ExtendClient({ rentalId, itemName, currentEndDate, dailyRateCents }: Props) {
  const [days, setDays] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const totalCents = days * dailyRateCents;
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

  async function handleExtend() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gear-extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalId, days, discountAmountCents: 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extension failed');
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.icon}>✉️</div>
          <h1 className={styles.title}>Payment Link Sent!</h1>
          <p className={styles.sub}>
            We&apos;ve emailed you a payment link for your {days}-day extension. Complete
            payment to confirm.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Extend Your Rental</h1>
        <p className={styles.sub}>
          <strong>{itemName}</strong> · Current return: <strong>{currentEndDate}</strong> at 3:00 PM
        </p>

        <div className={styles.field}>
          <label className={styles.label}>Additional Days</label>
          <div className={styles.stepper}>
            <button className={styles.stepBtn} onClick={() => setDays(d => Math.max(1, d - 1))}>−</button>
            <span className={styles.stepVal}>{days}</span>
            <button className={styles.stepBtn} onClick={() => setDays(d => d + 1)}>+</button>
          </div>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>{fmt(dailyRateCents / 100 * 100)} × {days} days</span>
            <span>{fmt(totalCents)}</span>
          </div>
          <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
            <span>Total</span>
            <span>{fmt(totalCents)}</span>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.btn} onClick={handleExtend} disabled={loading}>
          {loading ? 'Processing…' : `Request Extension · ${fmt(totalCents)}`}
        </button>
        <p className={styles.note}>A payment link will be sent to your email.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `extend.module.css`**

```css
.wrap {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  background: var(--br-deep, #0a0a0a);
}

.card {
  background: var(--br-surface, #141414);
  border: 1px solid var(--br-mid, #2a2a2a);
  border-radius: 12px;
  padding: 48px;
  max-width: 440px;
  width: 100%;
}

.icon { font-size: 48px; text-align: center; margin-bottom: 16px; }

.title {
  font-size: 24px;
  font-weight: 700;
  color: var(--br-text, #f5f5f5);
  margin: 0 0 12px;
}

.sub {
  font-size: 15px;
  color: var(--gray-70, #777);
  margin: 0 0 32px;
  line-height: 1.6;
}

.field { margin-bottom: 24px; }

.label {
  display: block;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--gray-70, #777);
  margin-bottom: 12px;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stepBtn {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--br-mid, #2a2a2a);
  background: var(--br-deep, #0a0a0a);
  color: var(--br-text, #f5f5f5);
  font-size: 20px;
  cursor: pointer;
}

.stepVal {
  font-size: 24px;
  font-weight: 700;
  color: var(--br-text, #f5f5f5);
  min-width: 32px;
  text-align: center;
}

.summary {
  border: 1px solid var(--br-mid, #2a2a2a);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

.summaryRow {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--gray-70, #777);
  padding: 4px 0;
}

.summaryTotal {
  font-weight: 700;
  color: var(--br-text, #f5f5f5);
  font-size: 16px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--br-mid, #2a2a2a);
}

.error { color: #ef4444; font-size: 14px; margin-bottom: 16px; }

.btn {
  width: 100%;
  padding: 14px;
  background: var(--br-accent, #2563eb);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.note { font-size: 12px; color: var(--gray-50, #555); text-align: center; margin-top: 12px; }
```

- [ ] **Step 4: Create `gear-extend` API**

```ts
// client/app/api/gear-extend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { sendExtensionPaymentEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { rentalId, days, discountAmountCents = 0 } = await req.json();

    if (!rentalId || !days || days < 1) {
      return NextResponse.json({ error: 'Missing rentalId or invalid days' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('*')
      .eq('rental_id', rentalId)
      .eq('status', 'active')
      .single();

    if (!rental) {
      return NextResponse.json({ error: 'Active rental not found' }, { status: 404 });
    }

    const dailyRateCents = rental.daily_rate_cents as number;
    const totalCents = Math.max(0, days * dailyRateCents - discountAmountCents);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: rental.customer_email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${rental.item_name} extension · ${days} extra ${days === 1 ? 'day' : 'days'}`,
              description: `Extends your rental by ${days} days`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/gear/extend/${rentalId}?extended=true`,
      cancel_url: `${baseUrl}/gear/extend/${rentalId}`,
      metadata: { rentalId, extensionDays: String(days), type: 'extension' },
    });

    // Store extension record
    await supabase.from('gear_rental_extensions').insert({
      rental_id: rentalId,
      extension_days: days,
      daily_rate_cents: dailyRateCents,
      discount_amount_cents: discountAmountCents,
      total_cents: totalCents,
      stripe_session_id: session.id,
    });

    // Send payment link email
    await sendExtensionPaymentEmail({
      to: rental.customer_email,
      customerName: rental.customer_name,
      itemName: rental.item_name,
      extensionDays: days,
      totalCents,
      stripeUrl: session.url!,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    console.error('Gear extend error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add client/app/gear/extend client/app/api/gear-extend
git commit -m "feat: rental extension pages and API"
```

---

## Task 11: Update GearRentalClient — availability badge

**Files:**
- Modify: `client/app/gear/GearRentalClient.tsx`

- [ ] **Step 1: Add availability state + useEffect**

Add the following state + effect after the existing state declarations:

```tsx
const [availability, setAvailability] = useState<{ available: boolean; count: number } | null>(null);
const [checkingAvail, setCheckingAvail] = useState(false);
```

Add the effect after the existing `useEffect`:

```tsx
useEffect(() => {
  if (!selected || !startDate || !endDate) {
    setAvailability(null);
    return;
  }
  setCheckingAvail(true);
  fetch(`/api/gear-availability?itemId=${selected.id}&startDate=${startDate}&endDate=${endDate}`)
    .then(r => r.json())
    .then(data => setAvailability(data))
    .catch(() => setAvailability(null))
    .finally(() => setCheckingAvail(false));
}, [selected, startDate, endDate]);
```

Update `canCheckout` to also require availability:

```tsx
const canCheckout = !!selected && days > 0 && name.trim() !== '' && email.trim() !== '' && (availability?.available ?? true);
```

Add an availability status display after the date grid section (inside the `{selected && (` block, after the `showCal` block):

```tsx
{days > 0 && (
  <div className={styles.availBadge} data-avail={checkingAvail ? 'checking' : availability?.available ? 'yes' : 'no'}>
    {checkingAvail
      ? '⏳ Checking availability…'
      : availability === null
      ? ''
      : availability.available
      ? `✅ ${availability.count} locker${availability.count !== 1 ? 's' : ''} available`
      : '❌ No lockers available for these dates'}
  </div>
)}
```

Add to `gear.module.css`:

```css
.availBadge {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 16px;
}

.availBadge[data-avail="yes"] {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.availBadge[data-avail="no"] {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.availBadge[data-avail="checking"] {
  background: rgba(100, 100, 100, 0.1);
  color: var(--gray-70, #777);
  border: 1px solid var(--br-mid, #2a2a2a);
}
```

- [ ] **Step 2: Commit**

```bash
git add client/app/gear/GearRentalClient.tsx client/app/gear/gear.module.css
git commit -m "feat: real-time availability badge in GearRentalClient"
```

---

## Task 12: Admin Portal — Locker Inventory Tab

**Files:**
- Modify: `client/app/admin/page.tsx`
- Modify: `client/app/admin/AdminClient.tsx`

- [ ] **Step 1: Update `admin/page.tsx`**

Add `LockerInventoryItem` import and lockers fetch:

```tsx
import { getLockerInventory, LockerInventoryItem } from '@/lib/lockers';

// In the isAdmin block, add:
let lockerInventory: LockerInventoryItem[] = [];

// In the Promise.all:
const [resResult, configResult, blockedResult, gearResult, lockerResult] = await Promise.all([
  supabase.from('reservations').select('*').order('created_at', { ascending: false }),
  supabase.from('pricing_config').select('key, value'),
  supabase.from('blocked_dates').select('date').order('date'),
  supabase.from('gear_rentals').select('*').order('created_at', { ascending: false }),
  getLockerInventory(),
]);
lockerInventory = lockerResult;
```

Pass to AdminClient:
```tsx
<AdminClient
  ...
  initialLockerInventory={lockerInventory}
/>
```

Update `GearRentalRow` type to include new fields:
```tsx
export interface GearRentalRow {
  // existing fields...
  validation_status: string;
  locker_access_code: string | null;
  id_photo_url: string | null;
  return_deadline: string | null;
}
```

- [ ] **Step 2: Update `AdminClient.tsx` — add Locker Inventory tab**

Add `LockerInventoryItem` to imports:
```tsx
import type { LockerInventoryItem } from '@/lib/lockers';
```

Add to Props:
```tsx
initialLockerInventory: LockerInventoryItem[];
```

Add to TABS array (after 'gear'):
```tsx
{ key: 'lockers', label: '🔒 Lockers' },
```

Add the Locker Inventory tab panel (add after the gear tab panel):

```tsx
{activeTab === 'lockers' && (
  <div className={styles.panel}>
    <h2 style={{ marginBottom: 24 }}>Locker Inventory</h2>
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>Gear</th>
            <th>Code</th>
            <th>Status</th>
            <th>Customer</th>
            <th>Pickup</th>
            <th>Return Deadline</th>
            <th>Time Remaining</th>
          </tr>
        </thead>
        <tbody>
          {initialLockerInventory.map(({ locker, status, rental }) => (
            <tr key={locker.id}>
              <td><strong>#{locker.locker_number}</strong></td>
              <td style={{ textTransform: 'capitalize' }}>{locker.item_id}</td>
              <td><code style={{ fontSize: 16, letterSpacing: '0.12em' }}>{locker.access_code}</code></td>
              <td>
                <span className={`${styles.badge} ${
                  status === 'occupied' ? styles.badgeRed :
                  status === 'reserved' ? styles.badgeAmber :
                  styles.badgeGreen
                }`}>
                  {status === 'occupied' ? '🔴 Occupied' : status === 'reserved' ? '🟡 Reserved' : '🟢 Available'}
                </span>
              </td>
              <td>{rental ? <><strong style={{ fontSize: 13 }}>{rental.customer_name}</strong></> : '—'}</td>
              <td style={{ fontSize: 12 }}>{rental?.start_date ?? '—'}</td>
              <td style={{ fontSize: 12 }}>
                {rental?.return_deadline
                  ? new Date(rental.return_deadline).toLocaleString('en-US', {
                      timeZone: 'America/Puerto_Rico',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </td>
              <td>
                {rental?.return_deadline ? (
                  <CountdownTimer deadline={rental.return_deadline} />
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}
```

Add the `CountdownTimer` component inside `AdminClient.tsx` (before the export):

```tsx
function CountdownTimer({ deadline }: { deadline: string }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('var(--gray-70)');

  useEffect(() => {
    function update() {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) { setLabel('OVERDUE'); setColor('#ef4444'); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(`${h}h ${m}m`);
      setColor(h < 3 ? '#ef4444' : h < 24 ? '#f59e0b' : '#10b981');
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [deadline]);

  return <span style={{ color, fontWeight: 600, fontSize: 13 }}>{label}</span>;
}
```

Add missing import at top of AdminClient:
```tsx
import { useEffect } from 'react';
```

Add `.badgeAmber` to `admin.module.css`:
```css
.badgeAmber { background: rgba(245,158,11,0.15); color: #f59e0b; }
```

- [ ] **Step 3: Commit**

```bash
git add client/app/admin/page.tsx client/app/admin/AdminClient.tsx client/app/admin/admin.module.css
git commit -m "feat: locker inventory tab in admin portal with countdown timers"
```

---

## Task 13: Run Full Test Suite

- [ ] **Step 1: Run all vitest tests**

```bash
cd client && npx vitest run
```

Expected: All tests PASS including:
- `__tests__/api.gear-availability.test.ts`
- `__tests__/lib.lockers.test.ts`
- `__tests__/api.gear-submit-id.test.ts`
- `__tests__/api.telegram-webhook.test.ts`
- `__tests__/api.gear-send-reminder.test.ts`
- All previous tests

- [ ] **Step 2: Fix any failures**

If any test fails, read the error, fix the root cause, re-run.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete locker inventory, ID verification, Telegram, emails, cron"
```

---

## Environment Variables Required

Add to `.env.local`:

```
RESEND_API_KEY=re_...            # from resend.com
TELEGRAM_BOT_TOKEN=...           # from @BotFather
TELEGRAM_ADMIN_CHAT_ID=...       # your Telegram chat ID (get from @userinfobot)
LOCKER_ADDRESS=Playa Luquillo, PR 00773
LOCKER_DIRECTIONS=From PR-3, take exit 31 toward Luquillo Beach. Lockers are at the main parking entrance.
FROM_EMAIL=BoxRetreat <noreply@yourdomain.com>
CRON_SECRET=...                  # random secret for cron auth
```

## Telegram Webhook Setup

After deploying to Vercel, register the webhook:
```bash
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://your-domain.vercel.app/api/telegram-webhook"
```

For local testing, use ngrok:
```bash
ngrok http 3001
curl "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://YOUR-NGROK-URL/api/telegram-webhook"
```
