# Gear Rental Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete gear rental system where customers select gear + dates, pay daily rate + $20 refundable deposit, receive a locker code, and return gear by uploading photos — with an admin panel to inspect returns and issue the deposit refund.

**Architecture:** Single Stripe Checkout session charges rental_total + $20 deposit together. On return approval, admin triggers a Stripe partial refund for $20. Supabase stores all rental state. The gear page at `/gear` replaces the existing `/shop` "Add to Stay" links. Photo uploads go server-side to Supabase Storage.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (DB + Storage) · Stripe Checkout + Refunds · React Day Picker · Vitest · CSS Modules · Bootstrap Icons

---

## File Map

### New files
| Path | Responsibility |
|------|---------------|
| `client/lib/gear.ts` | GEAR_ITEMS static catalog + GearItem type |
| `client/lib/locker.ts` | generateLockerCode(), daysBetween() |
| `client/app/gear/page.tsx` | Server component: renders GearRentalClient |
| `client/app/gear/GearRentalClient.tsx` | Client: item picker + date picker + checkout form |
| `client/app/gear/gear.module.css` | Styles for gear rental page |
| `client/app/gear/success/page.tsx` | Server component: verify Stripe session → show locker code |
| `client/app/gear/success/success.module.css` | Styles for success page |
| `client/app/gear/return/[rentalId]/page.tsx` | Server component: load rental, render ReturnClient |
| `client/app/gear/return/[rentalId]/ReturnClient.tsx` | Client: photo upload form |
| `client/app/gear/return/[rentalId]/return.module.css` | Styles for return page |
| `client/app/api/gear-checkout/route.ts` | POST: create rental record + Stripe session |
| `client/app/api/gear-return/route.ts` | POST: upload photos, set status=returned |
| `client/app/api/gear-release-deposit/route.ts` | POST: Stripe partial refund, set status=completed |
| `client/__tests__/gear.test.ts` | Unit tests for lib/gear.ts and lib/locker.ts |
| `supabase/migrations/001_gear_rentals.sql` | SQL to run in Supabase dashboard |

### Modified files
| Path | Change |
|------|--------|
| `client/components/home/GearSection.tsx` | Change "Add to stay" links from `/shop` to `/gear?item=<id>` |
| `client/app/admin/page.tsx` | Also fetch gear_rentals, pass to AdminClient |
| `client/app/admin/AdminClient.tsx` | Add "Gear Rentals" tab with return review + deposit release |

---

## Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/001_gear_rentals.sql`

- [ ] **Step 1: Create the migration SQL file**

```sql
-- supabase/migrations/001_gear_rentals.sql
-- Run this in Supabase Dashboard → SQL Editor

create table if not exists gear_rentals (
  id                    uuid primary key default gen_random_uuid(),
  rental_id             text unique not null,           -- e.g. GR-ABC123
  item_id               text not null,                  -- matches GearItem.id
  item_name             text not null,
  customer_email        text not null,
  customer_name         text not null,
  start_date            date not null,
  end_date              date not null,
  days                  integer not null,
  daily_rate_cents      integer not null,
  deposit_cents         integer not null default 2000,  -- $20.00
  rental_total_cents    integer not null,               -- days * daily_rate_cents
  grand_total_cents     integer not null,               -- rental_total_cents + deposit_cents
  stripe_session_id     text,
  stripe_payment_intent_id text,
  status                text not null default 'pending',
  -- pending | paid | active | returned | completed | cancelled
  locker_code           text,                           -- 4-digit code
  return_photo_urls     text[] not null default '{}',
  return_submitted_at   timestamptz,
  inspection_notes      text,
  deposit_released_at   timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Storage bucket for return photos (run separately in Storage section
-- or via Supabase dashboard: create public bucket named "gear-return-photos")
```

- [ ] **Step 2: Run the migration in Supabase**

  Go to your Supabase project → SQL Editor → paste the SQL above → Run.
  Verify the `gear_rentals` table appears in Table Editor.

- [ ] **Step 3: Create Storage bucket**

  Go to Supabase → Storage → New bucket → name: `gear-return-photos` → Public: ON → Save.
  (Public so admin can view photos directly by URL.)

- [ ] **Step 4: Commit the SQL file**

```bash
git add supabase/migrations/001_gear_rentals.sql
git commit -m "feat: add gear_rentals DB migration"
```

---

## Task 2: Pure Utility Libraries

**Files:**
- Create: `client/lib/gear.ts`
- Create: `client/lib/locker.ts`
- Test: `client/__tests__/gear.test.ts`

- [ ] **Step 1: Write failing tests**

Create `client/__tests__/gear.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GEAR_ITEMS, getGearItem } from '../lib/gear';
import { generateLockerCode, daysBetween } from '../lib/locker';

describe('GEAR_ITEMS', () => {
  it('has 6 items', () => {
    expect(GEAR_ITEMS).toHaveLength(6);
  });

  it('each item has required fields', () => {
    for (const item of GEAR_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.pricePerDay).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});

describe('getGearItem', () => {
  it('returns item by id', () => {
    const item = getGearItem('surfboard');
    expect(item?.name).toBe('Surfboard');
  });

  it('returns undefined for unknown id', () => {
    expect(getGearItem('unknown-xyz')).toBeUndefined();
  });
});

describe('generateLockerCode', () => {
  it('returns a 4-digit string', () => {
    const code = generateLockerCode();
    expect(code).toMatch(/^\d{4}$/);
  });

  it('returns values between 1000 and 9999', () => {
    for (let i = 0; i < 50; i++) {
      const code = parseInt(generateLockerCode(), 10);
      expect(code).toBeGreaterThanOrEqual(1000);
      expect(code).toBeLessThanOrEqual(9999);
    }
  });

  it('generates different codes', () => {
    const codes = new Set(Array.from({ length: 20 }, generateLockerCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('daysBetween', () => {
  it('returns 3 for a 3-day rental', () => {
    expect(daysBetween('2026-07-01', '2026-07-04')).toBe(3);
  });

  it('returns 1 for same-day to next-day', () => {
    expect(daysBetween('2026-07-01', '2026-07-02')).toBe(1);
  });

  it('returns 0 for same dates', () => {
    expect(daysBetween('2026-07-01', '2026-07-01')).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd client && npx vitest run __tests__/gear.test.ts
```

Expected: FAIL — "Cannot find module '../lib/gear'"

- [ ] **Step 3: Create `client/lib/gear.ts`**

```ts
export interface GearItem {
  id: string;
  name: string;
  pricePerDay: number; // USD
  icon: string;        // Bootstrap Icons class or 'custom-svg'
  description: string;
}

export const GEAR_ITEMS: GearItem[] = [
  {
    id: 'surfboard',
    name: 'Surfboard',
    pricePerDay: 35,
    icon: 'bi-tsunami',
    description: 'Foam longboard, ideal for beginners and intermediates.',
  },
  {
    id: 'snorkel',
    name: 'Snorkel Set',
    pricePerDay: 15,
    icon: 'bi-water',
    description: 'Full-face mask + snorkel + fins.',
  },
  {
    id: 'kayak',
    name: 'Kayak',
    pricePerDay: 45,
    icon: 'bi-water',
    description: 'Single sit-on-top kayak with paddle.',
  },
  {
    id: 'gopro',
    name: 'GoPro Hero',
    pricePerDay: 25,
    icon: 'bi-camera-fill',
    description: 'GoPro Hero 12 Black + waterproof case + mounts.',
  },
  {
    id: 'bike',
    name: 'Bike',
    pricePerDay: 20,
    icon: 'bi-bicycle',
    description: 'Beach cruiser bicycle with helmet.',
  },
  {
    id: 'beach-set',
    name: 'Beach Set',
    pricePerDay: 18,
    icon: 'bi-umbrella-fill',
    description: 'Umbrella + 2 chairs + cooler bag.',
  },
];

export function getGearItem(id: string): GearItem | undefined {
  return GEAR_ITEMS.find(g => g.id === id);
}
```

- [ ] **Step 4: Create `client/lib/locker.ts`**

```ts
export function generateLockerCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function daysBetween(startDate: string, endDate: string): number {
  const s = new Date(startDate + 'T12:00:00');
  const e = new Date(endDate + 'T12:00:00');
  return Math.round((e.getTime() - s.getTime()) / 86_400_000);
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd client && npx vitest run __tests__/gear.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add client/lib/gear.ts client/lib/locker.ts client/__tests__/gear.test.ts
git commit -m "feat: add gear catalog and locker utilities"
```

---

## Task 3: Gear Checkout API

**Files:**
- Create: `client/app/api/gear-checkout/route.ts`

- [ ] **Step 1: Create `client/app/api/gear-checkout/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { getGearItem } from '@/lib/gear';
import { generateLockerCode, daysBetween } from '@/lib/locker';

const DEPOSIT_CENTS = 2000; // $20.00

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

    const dailyRateCents = item.pricePerDay * 100;
    const rentalTotalCents = dailyRateCents * days;
    const grandTotalCents = rentalTotalCents + DEPOSIT_CENTS;
    const rentalId = `GR-${Date.now().toString(36).toUpperCase()}`;
    const lockerCode = generateLockerCode();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';

    // Create rental record BEFORE Stripe session so we can store rentalId in metadata
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
      locker_code: lockerCode,
      status: 'pending',
    });

    if (dbError) {
      console.error('DB insert error:', dbError);
      return NextResponse.json({ error: 'Could not create rental record' }, { status: 500 });
    }

    // Create Stripe Checkout session
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

    // Store stripe session id
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

- [ ] **Step 2: Verify the API route compiles without errors**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors for this file. (Other pre-existing type errors are acceptable if they existed before.)

- [ ] **Step 3: Commit**

```bash
git add client/app/api/gear-checkout/route.ts
git commit -m "feat: add gear checkout API route"
```

---

## Task 4: Gear Rental Page

**Files:**
- Create: `client/app/gear/page.tsx`
- Create: `client/app/gear/GearRentalClient.tsx`
- Create: `client/app/gear/gear.module.css`

- [ ] **Step 1: Create `client/app/gear/gear.module.css`**

```css
.hero {
  background: var(--br-darkest);
  padding: 80px 0 40px;
  border-bottom: 1px solid var(--br-mid);
}

.heroTitle {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 700;
  color: var(--br-white);
  margin-bottom: 12px;
  line-height: 1.1;
}

.heroSub {
  font-size: 15px;
  color: var(--br-light);
  max-width: 480px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.card {
  border: 1px solid var(--br-mid);
  background: var(--br-dark);
  transition: border-color 0.15s;
}
.card:hover { border-color: var(--br-lightest); }
.card.selected { border-color: var(--br-lightest); }

.cardBody { padding: 20px; }

.cardIcon {
  font-size: 32px;
  color: var(--br-lightest);
  margin-bottom: 12px;
}

.cardName {
  font-size: 16px;
  font-weight: 700;
  color: var(--br-white);
  margin-bottom: 4px;
}

.cardDesc {
  font-size: 13px;
  color: var(--br-light);
  margin-bottom: 16px;
  line-height: 1.5;
}

.cardPrice {
  font-size: 22px;
  font-weight: 700;
  color: var(--br-white);
}

.cardPriceSub {
  font-size: 12px;
  color: var(--br-mid);
  margin-left: 4px;
}

.selectBtn {
  width: 100%;
  padding: 12px;
  justify-content: center;
  margin-top: 16px;
  font-size: 13px;
}

/* Booking panel */
.bookingPanel {
  position: sticky;
  top: 80px;
  border: 1px solid var(--br-mid);
  background: var(--br-dark);
  padding: 24px;
}

.panelTitle {
  font-size: 16px;
  font-weight: 700;
  color: var(--br-white);
  margin-bottom: 20px;
}

.dateGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.dateBox {
  border: 1px solid var(--br-mid);
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.dateBox:hover { border-color: var(--br-lightest); }

.dateLabel {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--br-mid);
  margin-bottom: 4px;
}

.dateVal {
  font-size: 14px;
  font-weight: 600;
  color: var(--br-lightest);
}

.calendarWrap {
  border: 1px solid var(--br-mid);
  border-top: none;
  background: var(--br-darkest);
  padding: 8px;
  margin-bottom: 12px;
  overflow-x: auto;
}

.calendarWrap :global(.rdp-day_selected) {
  background: var(--br-lightest) !important;
  color: var(--br-darkest) !important;
  border-radius: 0 !important;
}
.calendarWrap :global(.rdp-day_range_middle) {
  background: var(--br-dark) !important;
  color: var(--br-lightest) !important;
  border-radius: 0 !important;
}
.calendarWrap :global(.rdp-button:hover:not([disabled])) {
  background: var(--br-dark) !important;
  border-radius: 0 !important;
}
.calendarWrap :global(.rdp) { color: var(--br-lightest); }

.field {
  margin-bottom: 12px;
}

.fieldLabel {
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--br-mid);
  margin-bottom: 6px;
}

.input {
  width: 100%;
  background: var(--br-darkest);
  border: 1px solid var(--br-mid);
  color: var(--br-lightest);
  padding: 12px;
  font-family: var(--font);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.input:focus { border-color: var(--br-lightest); }
.input::placeholder { color: var(--br-mid); }

.summary {
  border-top: 1px solid var(--br-mid);
  padding-top: 16px;
  margin-top: 16px;
}

.summaryRow {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--br-light);
  margin-bottom: 8px;
}

.summaryTotal {
  font-size: 15px;
  font-weight: 700;
  color: var(--br-white);
}

.reserveBtn {
  width: 100%;
  justify-content: center;
  margin-top: 16px;
  padding: 16px;
}

.error {
  color: #e05a5a;
  font-size: 13px;
  margin-top: 8px;
}

.note {
  font-size: 11px;
  color: var(--br-mid);
  text-align: center;
  margin-top: 8px;
}

.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  align-items: start;
}

@media (min-width: 900px) {
  .layout {
    grid-template-columns: 1fr 380px;
  }
}
```

- [ ] **Step 2: Create `client/app/gear/GearRentalClient.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { GEAR_ITEMS, GearItem } from '@/lib/gear';
import { daysBetween } from '@/lib/locker';
import styles from './gear.module.css';

const DEPOSIT = 20;

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

export function GearRentalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselect = searchParams.get('item') ?? '';

  const [selected, setSelected] = useState<GearItem | null>(
    () => GEAR_ITEMS.find(g => g.id === preselect) ?? null
  );
  const [range, setRange] = useState<DateRange | undefined>();
  const [showCal, setShowCal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-open calendar when item is selected
  useEffect(() => {
    if (selected) setShowCal(true);
  }, [selected]);

  const startDate = range?.from ? toISO(range.from) : null;
  const endDate = range?.to ? toISO(range.to) : null;
  const days = startDate && endDate ? daysBetween(startDate, endDate) : 0;
  const rentalTotal = selected ? days * selected.pricePerDay : 0;
  const grandTotal = rentalTotal + (days > 0 ? DEPOSIT : 0);

  const canCheckout = !!selected && days > 0 && name.trim() && email.trim();

  async function handleCheckout() {
    if (!canCheckout || !selected || !startDate || !endDate) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gear-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selected.id,
          startDate,
          endDate,
          customerName: name.trim(),
          customerEmail: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      router.push(data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const today = new Date();

  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <p className="eyebrow" style={{ color: 'var(--br-mid)', marginBottom: 12 }}>
            LUQUILLO · PUERTO RICO
          </p>
          <h1 className={styles.heroTitle}>Gear Rentals</h1>
          <p className={styles.heroSub}>
            Select your gear, pick your dates, and get a locker code after checkout.
            $20 refundable deposit — returned within 48h after inspection.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.layout}>
            {/* Left: gear grid */}
            <div>
              <p className="eyebrow" style={{ marginBottom: 24 }}>CHOOSE YOUR GEAR</p>
              <div className={styles.grid}>
                {GEAR_ITEMS.map(item => (
                  <div
                    key={item.id}
                    className={`${styles.card} ${selected?.id === item.id ? styles.selected : ''}`}
                  >
                    <div className={styles.cardBody}>
                      <div className={styles.cardIcon}>
                        <i className={item.icon} />
                      </div>
                      <h3 className={styles.cardName}>{item.name}</h3>
                      <p className={styles.cardDesc}>{item.description}</p>
                      <div>
                        <span className={styles.cardPrice}>{fmt(item.pricePerDay)}</span>
                        <span className={styles.cardPriceSub}>/ day</span>
                      </div>
                      <button
                        className={`btn-primary ${styles.selectBtn}`}
                        onClick={() => setSelected(item)}
                      >
                        {selected?.id === item.id ? (
                          <><i className="bi-check-lg" style={{ marginRight: 6 }} />Selected</>
                        ) : 'Select'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: booking panel */}
            <div className={styles.bookingPanel}>
              <p className={styles.panelTitle}>
                {selected ? `Reserve · ${selected.name}` : 'Select gear to continue'}
              </p>

              {selected && (
                <>
                  {/* Date picker */}
                  <div
                    className={styles.dateGrid}
                    onClick={() => setShowCal(v => !v)}
                  >
                    <div className={styles.dateBox}>
                      <p className={styles.dateLabel}>START DATE</p>
                      <p className={styles.dateVal}>{startDate ?? '— select —'}</p>
                    </div>
                    <div className={styles.dateBox}>
                      <p className={styles.dateLabel}>END DATE</p>
                      <p className={styles.dateVal}>{endDate ?? '— select —'}</p>
                    </div>
                  </div>

                  {showCal && (
                    <div className={styles.calendarWrap}>
                      <DayPicker
                        mode="range"
                        selected={range}
                        onSelect={setRange}
                        disabled={{ before: today }}
                        numberOfMonths={1}
                      />
                    </div>
                  )}

                  {/* Customer info */}
                  <div className={styles.field}>
                    <p className={styles.fieldLabel}>YOUR NAME</p>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="First and last name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <p className={styles.fieldLabel}>EMAIL</p>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>

                  {/* Price summary */}
                  {days > 0 && (
                    <div className={styles.summary}>
                      <div className={styles.summaryRow}>
                        <span>{fmt(selected.pricePerDay)} × {days} {days === 1 ? 'day' : 'days'}</span>
                        <span>{fmt(rentalTotal)}</span>
                      </div>
                      <div className={styles.summaryRow}>
                        <span>Security deposit (refundable)</span>
                        <span>{fmt(DEPOSIT)}</span>
                      </div>
                      <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                        <span>Total charged today</span>
                        <span>{fmt(grandTotal)}</span>
                      </div>
                    </div>
                  )}

                  {error && <p className={styles.error}>{error}</p>}

                  <button
                    className={`btn-primary ${styles.reserveBtn}`}
                    onClick={handleCheckout}
                    disabled={!canCheckout || loading}
                  >
                    {loading ? 'Processing...' : `Reserve → ${canCheckout ? fmt(grandTotal) : ''}`}
                  </button>
                  <p className={styles.note}>
                    $20 deposit returned within 48h after gear inspection.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 3: Create `client/app/gear/page.tsx`**

```tsx
import { Suspense } from 'react';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { GearRentalClient } from './GearRentalClient';

export const metadata = {
  title: 'Gear Rentals — BoxRetreat · Luquillo, Puerto Rico',
  description: 'Rent surfboards, kayaks, snorkel sets, GoPros, bikes, and beach sets. Delivered to BoxRetreat.',
};

export default function GearPage() {
  return (
    <>
      <Nav />
      <main>
        <Suspense fallback={null}>
          <GearRentalClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 4: Update `client/components/home/GearSection.tsx` — change links to `/gear?item=<id>`**

Find the "Add to stay" links in GearSection.tsx. Each gear item's link currently goes to `/shop`. Replace each with `/gear?item=<id>` where the id matches the GEAR_ITEMS ids.

Open `client/components/home/GearSection.tsx` and change every instance of:
- `href="/shop"` → `href="/gear?item=surfboard"` (for Surfboard)
- Apply the same pattern for all 6 items using the correct ids:
  - Surfboard → `surfboard`
  - Snorkel set → `snorkel`
  - Kayak → `kayak`
  - GoPro → `gopro`
  - Bike → `bike`
  - Beach set → `beach-set`

If the items don't have individual hrefs, add `href={/gear?item=${id}}` to each card's "Add to stay" anchor.

- [ ] **Step 5: Run dev server and verify `/gear` page loads**

```bash
cd client && npm run dev -- --port 3001
```

Open http://localhost:3001/gear — verify:
- Hero shows "Gear Rentals"
- 6 gear cards render
- Clicking "Select" on a card highlights it and opens the calendar in the right panel
- Picking a date range shows price summary

- [ ] **Step 6: Commit**

```bash
git add client/app/gear/ client/components/home/GearSection.tsx
git commit -m "feat: add gear rental page with item selection and date picker"
```

---

## Task 5: Gear Success Page

**Files:**
- Create: `client/app/gear/success/page.tsx`
- Create: `client/app/gear/success/success.module.css`

- [ ] **Step 1: Create `client/app/gear/success/success.module.css`**

```css
.wrap {
  min-height: 100vh;
  background: var(--br-darkest);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.card {
  max-width: 480px;
  width: 100%;
  border: 1px solid var(--br-mid);
  background: var(--br-dark);
  padding: 48px 40px;
  text-align: center;
}

.icon {
  font-size: 48px;
  color: var(--br-lightest);
  margin-bottom: 24px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: var(--br-white);
  margin-bottom: 8px;
}

.sub {
  font-size: 14px;
  color: var(--br-light);
  margin-bottom: 32px;
}

.codeLabel {
  font-size: 10px;
  letter-spacing: 0.12em;
  color: var(--br-mid);
  margin-bottom: 12px;
}

.code {
  font-size: 56px;
  font-weight: 700;
  color: var(--br-white);
  letter-spacing: 0.2em;
  margin-bottom: 8px;
}

.codeNote {
  font-size: 12px;
  color: var(--br-mid);
  margin-bottom: 32px;
}

.details {
  border-top: 1px solid var(--br-mid);
  padding-top: 24px;
  text-align: left;
}

.detailRow {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--br-light);
  margin-bottom: 10px;
}

.detailVal {
  color: var(--br-lightest);
  font-weight: 600;
}

.returnLink {
  display: block;
  margin-top: 32px;
  font-size: 13px;
  color: var(--br-mid);
  text-align: center;
}

.returnLink a {
  color: var(--br-lightest);
  text-decoration: underline;
}

.errorWrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--br-light);
  font-size: 16px;
}
```

- [ ] **Step 2: Create `client/app/gear/success/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import styles from './success.module.css';

export const metadata = {
  title: 'Booking Confirmed — BoxRetreat Gear Rentals',
};

interface Props {
  searchParams: { session_id?: string };
}

export default async function GearSuccessPage({ searchParams }: Props) {
  const sessionId = searchParams.session_id;

  if (!sessionId) redirect('/gear');

  let rental: Record<string, unknown> | null = null;

  try {
    // Verify payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      redirect('/gear');
    }

    const paymentIntentId = session.payment_intent as string | null;

    // Fetch rental record from DB
    const supabase = await createClient();
    const rentalId = session.metadata?.rentalId;

    const { data } = await supabase
      .from('gear_rentals')
      .select('*')
      .eq('rental_id', rentalId)
      .single();

    rental = data;

    // Update to active status + store payment intent id (idempotent)
    if (rental && rental.status === 'pending') {
      await supabase
        .from('gear_rentals')
        .update({
          status: 'active',
          stripe_payment_intent_id: paymentIntentId,
          updated_at: new Date().toISOString(),
        })
        .eq('rental_id', rentalId);
    }
  } catch (e) {
    console.error('Gear success error:', e);
  }

  if (!rental) {
    return (
      <>
        <Nav />
        <div className={styles.errorWrap}>
          Payment verified but rental record not found. Contact us at boxretreat@email.com.
        </div>
        <Footer />
      </>
    );
  }

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

  return (
    <>
      <Nav />
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.icon}>
            <i className="bi-check-circle-fill" />
          </div>
          <h1 className={styles.title}>You&apos;re confirmed!</h1>
          <p className={styles.sub}>
            Your {rental.item_name as string} rental is reserved. Use the code below to unlock your locker.
          </p>

          <p className={styles.codeLabel}>LOCKER CODE</p>
          <p className={styles.code}>{rental.locker_code as string}</p>
          <p className={styles.codeNote}>
            Enter this code on the lockbox at BoxRetreat to pick up your gear.
          </p>

          <div className={styles.details}>
            <div className={styles.detailRow}>
              <span>Item</span>
              <span className={styles.detailVal}>{rental.item_name as string}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Rental dates</span>
              <span className={styles.detailVal}>
                {rental.start_date as string} → {rental.end_date as string}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span>Duration</span>
              <span className={styles.detailVal}>
                {rental.days as number} {(rental.days as number) === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span>Rental fee</span>
              <span className={styles.detailVal}>{fmt(rental.rental_total_cents as number)}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Security deposit</span>
              <span className={styles.detailVal}>{fmt(rental.deposit_cents as number)} (refundable)</span>
            </div>
          </div>

          <p className={styles.returnLink}>
            When done, return the gear and{' '}
            <a href={`/gear/return/${rental.rental_id}`}>submit your photos here</a>{' '}
            to get your deposit back.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 3: Verify the success page compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add client/app/gear/success/
git commit -m "feat: add gear rental success page with locker code display"
```

---

## Task 6: Gear Return Page

**Files:**
- Create: `client/app/gear/return/[rentalId]/page.tsx`
- Create: `client/app/gear/return/[rentalId]/ReturnClient.tsx`
- Create: `client/app/gear/return/[rentalId]/return.module.css`
- Create: `client/app/api/gear-return/route.ts`

- [ ] **Step 1: Create `client/app/gear/return/[rentalId]/return.module.css`**

```css
.wrap {
  min-height: 100vh;
  background: var(--br-darkest);
  padding: 80px 24px 60px;
}

.inner {
  max-width: 560px;
  margin: 0 auto;
}

.title {
  font-size: 28px;
  font-weight: 700;
  color: var(--br-white);
  margin-bottom: 8px;
}

.sub {
  font-size: 14px;
  color: var(--br-light);
  margin-bottom: 32px;
  line-height: 1.6;
}

.infoBox {
  border: 1px solid var(--br-mid);
  background: var(--br-dark);
  padding: 20px;
  margin-bottom: 32px;
}

.infoRow {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--br-light);
  margin-bottom: 8px;
}

.infoVal {
  color: var(--br-lightest);
  font-weight: 600;
}

.uploadArea {
  border: 2px dashed var(--br-mid);
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s;
  margin-bottom: 16px;
}
.uploadArea:hover { border-color: var(--br-lightest); }

.uploadIcon {
  font-size: 32px;
  color: var(--br-mid);
  margin-bottom: 12px;
}

.uploadText {
  font-size: 14px;
  color: var(--br-light);
}

.uploadNote {
  font-size: 12px;
  color: var(--br-mid);
  margin-top: 4px;
}

.previews {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.preview {
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid var(--br-mid);
}

.submitBtn {
  width: 100%;
  justify-content: center;
  padding: 16px;
  margin-top: 8px;
}

.error {
  color: #e05a5a;
  font-size: 13px;
  margin-top: 8px;
}

.successBox {
  border: 1px solid var(--br-mid);
  background: var(--br-dark);
  padding: 32px;
  text-align: center;
}

.successIcon {
  font-size: 40px;
  color: var(--br-lightest);
  margin-bottom: 16px;
}

.successTitle {
  font-size: 20px;
  font-weight: 700;
  color: var(--br-white);
  margin-bottom: 8px;
}

.successSub {
  font-size: 14px;
  color: var(--br-light);
  line-height: 1.6;
}

.notFoundWrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--br-light);
  font-size: 16px;
}
```

- [ ] **Step 2: Create `client/app/api/gear-return/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rentalId = formData.get('rentalId') as string;
    const files = formData.getAll('photos') as File[];

    if (!rentalId || files.length === 0) {
      return NextResponse.json({ error: 'Missing rentalId or photos' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify rental exists and is active
    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('id, status, rental_id')
      .eq('rental_id', rentalId)
      .single();

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    if (rental.status === 'returned' || rental.status === 'completed') {
      return NextResponse.json({ error: 'Return already submitted' }, { status: 409 });
    }

    // Upload each photo to Supabase Storage
    const photoUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${rentalId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from('gear-return-photos')
        .upload(path, buffer, { contentType: file.type, upsert: false });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
      }

      const { data: urlData } = supabase.storage
        .from('gear-return-photos')
        .getPublicUrl(path);

      photoUrls.push(urlData.publicUrl);
    }

    // Update rental record
    const { error: updateError } = await supabase
      .from('gear_rentals')
      .update({
        status: 'returned',
        return_photo_urls: photoUrls,
        return_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('rental_id', rentalId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Could not update rental' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('Gear return error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Return submission failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create `client/app/gear/return/[rentalId]/ReturnClient.tsx`**

```tsx
'use client';

import { useState, useRef } from 'react';
import styles from './return.module.css';

interface Props {
  rentalId: string;
  itemName: string;
  returnSubmitted: boolean;
}

export function ReturnClient({ rentalId, itemName, returnSubmitted: initialSubmitted }: Props) {
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return;
    const arr = Array.from(incoming).slice(0, 6 - files.length);
    const newFiles = [...files, ...arr];
    setFiles(newFiles);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setPreviews(newPreviews);
  }

  async function handleSubmit() {
    if (files.length === 0) {
      setError('Please add at least one photo of the returned gear.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('rentalId', rentalId);
      files.forEach(f => fd.append('photos', f));

      const res = await fetch('/api/gear-return', { method: 'POST', body: fd });
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
      <div className={styles.successBox}>
        <div className={styles.successIcon}>
          <i className="bi-shield-check" />
        </div>
        <h2 className={styles.successTitle}>Return received!</h2>
        <p className={styles.successSub}>
          We will inspect the gear and release your $20 deposit within 48 hours.
          You&apos;ll see the refund on your card automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className={styles.sub}>
        Place the {itemName} back in the locker, then upload 2–6 photos showing the gear
        in good condition. We&apos;ll release your $20 deposit within 48 hours.
      </p>

      {/* Upload area */}
      <div
        className={styles.uploadArea}
        onClick={() => inputRef.current?.click()}
      >
        <div className={styles.uploadIcon}>
          <i className="bi-cloud-upload" />
        </div>
        <p className={styles.uploadText}>Click to add photos</p>
        <p className={styles.uploadNote}>JPG, PNG, HEIC — up to 6 photos</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {previews.length > 0 && (
        <div className={styles.previews}>
          {previews.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt={`Photo ${i + 1}`} className={styles.preview} />
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={`btn-primary ${styles.submitBtn}`}
        onClick={handleSubmit}
        disabled={loading || files.length === 0}
      >
        {loading
          ? 'Uploading...'
          : `Submit return${files.length > 0 ? ` (${files.length} photo${files.length > 1 ? 's' : ''})` : ''}`}
      </button>
    </>
  );
}
```

- [ ] **Step 4: Create `client/app/gear/return/[rentalId]/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { ReturnClient } from './ReturnClient';
import styles from './return.module.css';

export const metadata = {
  title: 'Return Gear — BoxRetreat',
};

interface Props {
  params: { rentalId: string };
}

export default async function GearReturnPage({ params }: Props) {
  const { rentalId } = params;
  const supabase = await createClient();

  const { data: rental } = await supabase
    .from('gear_rentals')
    .select('rental_id, item_name, status, start_date, end_date, deposit_cents')
    .eq('rental_id', rentalId)
    .single();

  if (!rental) {
    return (
      <>
        <Nav />
        <div className={styles.notFoundWrap}>
          Rental not found. Check the link and try again.
        </div>
        <Footer />
      </>
    );
  }

  const returnSubmitted = rental.status === 'returned' || rental.status === 'completed';

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

  return (
    <>
      <Nav />
      <main className={styles.wrap}>
        <div className={styles.inner}>
          <h1 className={styles.title}>Return {rental.item_name}</h1>

          <div className={styles.infoBox}>
            <div className={styles.infoRow}>
              <span>Rental ID</span>
              <span className={styles.infoVal}>{rental.rental_id}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Dates</span>
              <span className={styles.infoVal}>
                {rental.start_date} → {rental.end_date}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span>Deposit to be returned</span>
              <span className={styles.infoVal}>{fmt(rental.deposit_cents)}</span>
            </div>
          </div>

          <ReturnClient
            rentalId={rental.rental_id}
            itemName={rental.item_name}
            returnSubmitted={returnSubmitted}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 5: Verify compilation**

```bash
cd client && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add client/app/gear/return/ client/app/api/gear-return/
git commit -m "feat: add gear return page with photo upload"
```

---

## Task 7: Deposit Release API

**Files:**
- Create: `client/app/api/gear-release-deposit/route.ts`

- [ ] **Step 1: Create `client/app/api/gear-release-deposit/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rentalId } = body;

    if (!rentalId) {
      return NextResponse.json({ error: 'Missing rentalId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('rental_id, status, deposit_cents, stripe_payment_intent_id')
      .eq('rental_id', rentalId)
      .single();

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    if (rental.status === 'completed') {
      return NextResponse.json({ error: 'Deposit already released' }, { status: 409 });
    }

    if (rental.status !== 'returned') {
      return NextResponse.json({ error: 'Gear not returned yet' }, { status: 409 });
    }

    if (!rental.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent found for this rental' }, { status: 400 });
    }

    // Issue partial Stripe refund for deposit amount
    const refund = await stripe.refunds.create({
      payment_intent: rental.stripe_payment_intent_id,
      amount: rental.deposit_cents, // e.g. 2000 = $20.00
    });

    // Update rental status
    await supabase
      .from('gear_rentals')
      .update({
        status: 'completed',
        deposit_released_at: new Date().toISOString(),
        inspection_notes: `Deposit $${rental.deposit_cents / 100} refunded via Stripe refund ${refund.id}`,
        updated_at: new Date().toISOString(),
      })
      .eq('rental_id', rentalId);

    return NextResponse.json({ ok: true, refundId: refund.id });
  } catch (e: unknown) {
    console.error('Release deposit error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Refund failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/app/api/gear-release-deposit/route.ts
git commit -m "feat: add deposit release API with Stripe partial refund"
```

---

## Task 8: Admin Gear Rentals Tab

**Files:**
- Modify: `client/app/admin/page.tsx`
- Modify: `client/app/admin/AdminClient.tsx`

- [ ] **Step 1: Add `GearRentalRow` type and gear rentals fetch to `client/app/admin/page.tsx`**

Add this interface at the bottom of `client/app/admin/page.tsx` (after the existing `ReservationRow` interface):

```ts
export interface GearRentalRow {
  id: string;
  rental_id: string;
  item_name: string;
  customer_name: string;
  customer_email: string;
  start_date: string;
  end_date: string;
  days: number;
  rental_total_cents: number;
  deposit_cents: number;
  grand_total_cents: number;
  status: string;
  locker_code: string;
  return_photo_urls: string[];
  return_submitted_at: string | null;
  deposit_released_at: string | null;
  created_at: string;
}
```

Then in the `AdminPage` function, inside the `if (isAdmin)` block, add gear rentals to the `Promise.all`:

Replace this block:
```ts
    const [resResult, configResult, blockedResult] = await Promise.all([
      supabase.from('reservations').select('*').order('created_at', { ascending: false }),
      supabase.from('pricing_config').select('key, value'),
      supabase.from('blocked_dates').select('date').order('date'),
    ]);
    reservations = resResult.data ?? [];
    pricingConfig = Object.fromEntries((configResult.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    blockedDates = (blockedResult.data ?? []).map((r: { date: string }) => r.date);
```

With this:
```ts
    const [resResult, configResult, blockedResult, gearResult] = await Promise.all([
      supabase.from('reservations').select('*').order('created_at', { ascending: false }),
      supabase.from('pricing_config').select('key, value'),
      supabase.from('blocked_dates').select('date').order('date'),
      supabase.from('gear_rentals').select('*').order('created_at', { ascending: false }),
    ]);
    reservations = resResult.data ?? [];
    pricingConfig = Object.fromEntries((configResult.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    blockedDates = (blockedResult.data ?? []).map((r: { date: string }) => r.date);
    gearRentals = gearResult.data ?? [];
```

Also add `let gearRentals: GearRentalRow[] = [];` alongside the other `let` declarations, and add `initialGearRentals={gearRentals}` to the `<AdminClient>` component.

- [ ] **Step 2: Add Gear Rentals tab to `client/app/admin/AdminClient.tsx`**

In `AdminClient.tsx`, add the `GearRentalRow` import at the top:

```ts
import type { ReservationRow, GearRentalRow } from './page';
```

Add `initialGearRentals: GearRentalRow[]` to the `Props` interface.

Add `'gear'` tab to the `TABS` array:
```ts
const TABS = [
  { key: 'reservations', label: 'Reservaciones' },
  { key: 'pricing', label: 'Precios' },
  { key: 'blocked', label: 'Fechas Bloqueadas' },
  { key: 'gear', label: 'Gear Rentals' },
  { key: 'reports', label: 'Reportes P&L' },
];
```

Add a `releasingDeposit` state:
```ts
const [releasingDeposit, setReleasingDeposit] = useState<string | null>(null);
```

Add a `releaseDeposit` function:
```ts
async function releaseDeposit(rentalId: string) {
  setReleasingDeposit(rentalId);
  try {
    const res = await fetch('/api/gear-release-deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rentalId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Release failed');
    router.refresh(); // Re-fetch from server
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : 'Failed to release deposit');
  } finally {
    setReleasingDeposit(null);
  }
}
```

Add the gear rentals tab panel content (insert after the `{activeTab === 'blocked' && ...}` block and before `{activeTab === 'reports' && ...}`):

```tsx
{activeTab === 'gear' && (
  <div className={styles.panel}>
    <h2 style={{ marginBottom: 24 }}>Gear Rentals</h2>
    {initialGearRentals.length === 0 ? (
      <p style={{ color: 'var(--gray-70)' }}>No gear rentals yet.</p>
    ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th><th>Customer</th><th>Gear</th><th>Dates</th>
              <th>Total</th><th>Code</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {initialGearRentals.map(r => (
              <tr key={r.id}>
                <td><code style={{ fontSize: 11 }}>{r.rental_id}</code></td>
                <td>
                  <strong style={{ fontSize: 13 }}>{r.customer_name}</strong>
                  <br /><span style={{ fontSize: 12, color: 'var(--gray-70)' }}>{r.customer_email}</span>
                </td>
                <td>{r.item_name}</td>
                <td style={{ fontSize: 12 }}>{r.start_date}<br />{r.end_date}</td>
                <td><strong>{fmt(r.grand_total_cents / 100)}</strong></td>
                <td><code style={{ fontSize: 18, letterSpacing: '0.1em' }}>{r.locker_code}</code></td>
                <td>
                  <span className={`${styles.badge} ${
                    r.status === 'completed' ? styles.badgeGreen :
                    r.status === 'returned' ? styles.badgeGray :
                    r.status === 'active' ? styles.badgeGray :
                    styles.badgeGray
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  {r.status === 'returned' && (
                    <div>
                      {r.return_photo_urls.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                          {r.return_photo_urls.slice(0, 3).map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Return photo ${i + 1}`}
                                style={{ width: 48, height: 48, objectFit: 'cover', border: '1px solid var(--br-mid)' }}
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      <button
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: 12 }}
                        onClick={() => releaseDeposit(r.rental_id)}
                        disabled={releasingDeposit === r.rental_id}
                      >
                        {releasingDeposit === r.rental_id ? 'Processing...' : 'Release $20 deposit'}
                      </button>
                    </div>
                  )}
                  {r.status === 'completed' && (
                    <span style={{ fontSize: 12, color: 'var(--gray-70)' }}>
                      Deposit released<br />
                      {r.deposit_released_at ? new Date(r.deposit_released_at).toLocaleDateString() : ''}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Verify compilation**

```bash
cd client && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add client/app/admin/page.tsx client/app/admin/AdminClient.tsx
git commit -m "feat: add Gear Rentals tab to admin dashboard with deposit release"
```

---

## Task 9: Run Full Test Suite

**Files:** No changes

- [ ] **Step 1: Run all tests**

```bash
cd client && npx vitest run
```

Expected output:
```
✓ __tests__/pricing.test.ts (6)
✓ __tests__/gear.test.ts (9)

Test Files: 2 passed (2)
Tests: 15 passed (15)
```

- [ ] **Step 2: TypeScript check**

```bash
cd client && npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 3: Manual end-to-end smoke test**

Start the dev server:
```bash
cd client && npm run dev -- --port 3001
```

Test each step:
1. Go to http://localhost:3001 → click "Add to stay" on any GearSection card → should navigate to `/gear?item=<id>`
2. On `/gear` → select a gear item → pick dates → fill name + email → click Reserve → Stripe test checkout opens
3. In Stripe checkout, use test card `4242 4242 4242 4242`, any future date, any CVC → pay
4. Stripe redirects to `/gear/success?session_id=...` → locker code (4 digits) displayed
5. Click the return link → `/gear/return/<rentalId>` → upload at least one photo → Submit
6. Go to http://localhost:3001/admin → log in → click "Gear Rentals" tab → rental shows with status "returned" and photo thumbnail
7. Click "Release $20 deposit" → status changes to "completed"

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete gear rental flow — selection, checkout, locker code, return, deposit release"
```

---

## Self-Review

### 1. Spec Coverage

| Requirement | Covered by |
|-------------|-----------|
| Add to Stay → gear page | Task 4: GearSection links updated |
| Date selection per item | Task 4: GearRentalClient with DayPicker |
| Daily rate × days calculation | Task 4: GearRentalClient, Task 3: API |
| $20 deposit charged | Task 3: gear-checkout API line item |
| Stripe checkout | Task 3: gear-checkout API |
| Unique locker code | Task 2: lib/locker.ts generateLockerCode() |
| Code shown after payment | Task 5: gear/success page |
| Customer places gear in locker | User flow — no code needed |
| Photo upload on return | Task 6: ReturnClient + gear-return API |
| Supabase Storage for photos | Task 6: gear-return API uses supabase.storage |
| Admin sees returns + photos | Task 8: AdminClient Gear Rentals tab |
| Admin releases deposit (48h) | Task 7: gear-release-deposit API; Task 8: admin button |
| Stripe refund for deposit | Task 7: stripe.refunds.create() |
| DB stores all state | Task 1: gear_rentals table migration |

### 2. Placeholder Scan

No TBD, TODO, or incomplete steps found.

### 3. Type Consistency

- `GearItem` defined in `lib/gear.ts` Task 2, used in `GearRentalClient.tsx` Task 4 ✅
- `generateLockerCode` defined in `lib/locker.ts` Task 2, used in `gear-checkout/route.ts` Task 3 ✅
- `daysBetween` defined in `lib/locker.ts` Task 2, used in `GearRentalClient.tsx` Task 4 and `gear-checkout/route.ts` Task 3 ✅
- `GearRentalRow` defined in `admin/page.tsx` Task 8, used in `AdminClient.tsx` Task 8 ✅
- `rental_id` string field used consistently as the public-facing ID across all tasks ✅
- `deposit_cents: 2000` constant used in Task 3 API and Task 7 refund — consistent ✅
