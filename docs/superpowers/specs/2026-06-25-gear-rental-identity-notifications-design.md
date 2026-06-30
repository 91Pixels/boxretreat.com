# Gear Rental — Identity Verification, Notifications & Locker Inventory Design

## Goal

Extend the gear rental flow to add identity verification (post-payment), automatic email notifications via Resend, admin validation via Telegram bot, real-time locker inventory with availability checking, 3-hour return reminders via Vercel Cron, and extension/discount management in the admin portal.

## Architecture

**Tech Stack:** Next.js 14 App Router · Supabase (Postgres + Storage) · Stripe · Resend (email) · Telegram Bot API (admin validation) · Vercel Cron Jobs

**Principle:** No locker is revealed to the customer until the admin validates the ID via Telegram. Locker availability is checked both client-side (UX) and server-side (race condition guard) before payment.

---

## 1. Customer Flow (complete)

```
Select gear + dates
  → Real-time availability check (API)
  → If no lockers available: show "Sin disponibilidad" — STOP
  → If available: show form (name + email)
  → Pay via Stripe
  → Post-payment: ID verification page (/gear/verify/[rentalId])
  → Customer submits: ID type + ID number + ID photo
  → System sends Telegram message to admin with all evidence
  → Customer sees "Waiting for verification" screen
  → Admin replies "Validado" in Telegram
  → System auto-assigns first available locker for those dates
  → System sends confirmation email (Resend) to customer
  → Customer receives: locker code, locker number, address, directions, pickup date/time
```

---

## 2. Return Flow

```
12:00 PM on end_date:
  Vercel Cron (/api/gear-send-reminder)
  → Finds rentals where return_deadline = today 15:00 AND reminder_sent_at IS NULL
  → Sends reminder email: "Your rental ends at 3:00 PM today. Return or extend."
  → Updates reminder_sent_at
```

Return deadline = `end_date` at `15:00:00 America/Puerto_Rico` (UTC-4 = 19:00 UTC)

---

## 3. Extension Flow

```
Customer clicks "Extend" link in reminder email
  → Goes to /gear/extend/[rentalId]
  → Selects additional days
  → Admin portal: sees extension request
  → Admin optionally applies discount (sets discount_amount_cents)
  → Admin clicks "Send payment link"
  → System creates Stripe Checkout session with discounted price
  → Sends payment link to customer email
  → Customer pays
  → System updates return_deadline + sends new confirmation
```

---

## 4. Admin Validation (Telegram)

1. Customer submits ID → `/api/gear-submit-id` POST
2. API uploads photo to Supabase Storage (`id-photos/` bucket)
3. API sends Telegram message to admin (TELEGRAM_ADMIN_CHAT_ID) with:
   - Gear item + dates + customer name + email
   - ID type + number
   - ID photo (sent as document)
   - Rental ID
4. API stores `telegram_message_id` in `gear_rentals`
5. Customer sees pending screen
6. Admin reviews in Telegram app, replies "Validado" (case-insensitive)
7. `/api/telegram-webhook` POST receives update
8. System identifies rental by matching reply-to message_id
9. System runs availability check again (guard against race conditions)
10. Auto-assigns lowest-numbered available locker for gear type + dates
11. Updates rental: `validation_status='validated'`, `locker_id`, `locker_access_code`, `return_deadline`
12. Sends confirmation email via Resend
13. Updates `confirmation_sent_at`
14. Responds to Telegram: "✅ Confirmación enviada a {email}. Locker #{number}"

---

## 5. Locker Inventory System

### Table: `lockers`

```sql
create table lockers (
  id           uuid primary key default gen_random_uuid(),
  item_id      text not null,        -- 'surfboard', 'kayak', etc.
  locker_number integer not null,    -- physical number (1, 2, 3...)
  access_code  text not null,        -- 4-digit PIN
  description  text,                 -- e.g. "Blue locker near entrance"
  is_active    boolean not null default true,
  created_at   timestamptz default now(),
  unique(item_id, locker_number)
);
```

### Availability Query (for date range)

```sql
SELECT l.* FROM lockers l
WHERE l.item_id = :itemId
  AND l.is_active = true
  AND l.id NOT IN (
    SELECT gr.locker_id FROM gear_rentals gr
    WHERE gr.locker_id IS NOT NULL
      AND gr.status NOT IN ('cancelled', 'completed')
      AND gr.start_date <= :endDate
      AND gr.end_date >= :startDate
  )
ORDER BY l.locker_number ASC
LIMIT 1;
```

### Locker Status Definitions

| Status | Condition |
|--------|-----------|
| 🟢 Available | No active or future rental overlapping today |
| 🟡 Reserved | Future rental booked, start_date > today |
| 🔴 Occupied | Active rental: start_date ≤ today ≤ end_date, status='active' |

---

## 6. Admin Portal Enhancements

### Tab: "Locker Inventory"

Real-time table showing all lockers:
- Locker # | Gear type | Code | Status badge | Assigned to | Pickup | Return | Countdown timer

Countdown timer: client-side JS, recalculates every minute from `return_deadline`.
Color: green (>24h), amber (3–24h), red (<3h).

### Tab: "Gear Rentals" (updated)

New columns:
- `validation_status` badge: pending_id / id_submitted / validated / confirmed
- ID photo thumbnail (clickable → full view)
- "Send Confirmation" button (if validated but confirmation_sent_at IS NULL)

### Extension Panel (within Gear Rentals)

Per rental with status='active':
- "+ Extend" button → opens panel
- Input: extra days
- Input: discount % or $ amount
- Preview: original rate × days − discount = total
- "Send Payment Link" → calls `/api/gear-extend` → emails Stripe link to customer

---

## 7. Database Schema Changes

### New fields on `gear_rentals`

```sql
alter table gear_rentals add column id_type text;
alter table gear_rentals add column id_number text;
alter table gear_rentals add column id_photo_url text;
alter table gear_rentals add column locker_id uuid references lockers(id);
alter table gear_rentals add column locker_access_code text;
alter table gear_rentals add column validation_status text not null default 'pending_payment';
alter table gear_rentals add column telegram_message_id bigint;
alter table gear_rentals add column return_deadline timestamptz;
alter table gear_rentals add column confirmation_sent_at timestamptz;
alter table gear_rentals add column reminder_sent_at timestamptz;
```

### validation_status values

| Value | Meaning |
|-------|---------|
| `pending_payment` | Stripe session created, not paid yet |
| `pending_id` | Paid, waiting for customer to submit ID |
| `id_submitted` | Customer submitted ID, waiting admin validation |
| `validated` | Admin said "Validado", locker assigned |
| `confirmed` | Confirmation email sent |

### New table: `gear_rental_extensions`

```sql
create table gear_rental_extensions (
  id                      uuid primary key default gen_random_uuid(),
  rental_id               text not null references gear_rentals(rental_id),
  extension_days          integer not null,
  daily_rate_cents        integer not null,
  discount_amount_cents   integer not null default 0,
  total_cents             integer not null,
  stripe_session_id       text,
  stripe_payment_intent_id text,
  paid_at                 timestamptz,
  created_at              timestamptz default now()
);
```

---

## 8. New API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/gear-availability` | GET | `?itemId=&startDate=&endDate=` → `{ available: bool, count: number }` |
| `/api/gear-submit-id` | POST | FormData: rentalId, idType, idNumber, photo → uploads to Storage, sends Telegram |
| `/api/telegram-webhook` | POST | Telegram Bot webhook — handles "Validado" reply |
| `/api/gear-send-reminder` | GET | Vercel Cron endpoint — sends reminders for rentals ending today |
| `/api/gear-extend` | POST | `{ rentalId, days, discountAmountCents }` → creates Stripe session for extension |

### Updated routes

| Route | Change |
|-------|--------|
| `/api/gear-checkout` | Add availability check before insert; set `validation_status='pending_payment'` |
| `/gear/success/page.tsx` | After confirming payment, set status=`pending_id`, redirect to `/gear/verify/[rentalId]` |

---

## 9. New Pages

| Page | Type | Description |
|------|------|-------------|
| `/gear/verify/[rentalId]` | Client | ID verification form post-payment |
| `/gear/verify/[rentalId]/VerifyClient.tsx` | Client | ID type dropdown, number input, photo upload, "pending" screen |
| `/gear/extend/[rentalId]` | Client | Extension request form |

---

## 10. Email Templates (Resend)

### Confirmation Email

**Subject:** `Your BoxRetreat gear is ready — Locker #[N]`

Body:
- Locker number + access code (large, prominent)
- Gear item + dates
- Address: [address]
- Directions: [directions text]
- Pickup date/time
- Return deadline: [end_date] at 3:00 PM
- Link to return instructions

### Reminder Email

**Subject:** `Return your gear by 3:00 PM today`

Body:
- Rental summary
- Return deadline: TODAY at 3:00 PM
- Return instructions link: `/gear/return/[rentalId]`
- "Need more time?" → Extend link: `/gear/extend/[rentalId]`

---

## 11. Environment Variables (new)

```
RESEND_API_KEY=re_...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ADMIN_CHAT_ID=...  (numeric chat ID of admin's Telegram account)
LOCKER_ADDRESS="Playa Luquillo, PR 00773"
LOCKER_DIRECTIONS="From PR-3, take exit 31 toward Luquillo Beach. The lockers are in the blue building at the main parking entrance."
FROM_EMAIL="BoxRetreat <noreply@boxretreat.com>"
```

---

## 12. Vercel Cron Job

In `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/gear-send-reminder",
    "schedule": "0 16 * * *"
  }]
}
```

`0 16 * * *` = 16:00 UTC = 12:00 PM Puerto Rico (UTC-4)

The endpoint sends emails to all rentals where:
- `return_deadline::date = CURRENT_DATE`
- `reminder_sent_at IS NULL`
- `status = 'active'`
- `validation_status = 'confirmed'`

---

## 13. Locker Seed Data (initial)

```sql
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
  ('beach-set', 1, '7745', 'White locker #1');
```

---

## 14. File Map

| File | Action |
|------|--------|
| `supabase/migrations/002_lockers_and_id.sql` | New migration |
| `client/lib/email.ts` | Resend client + email templates |
| `client/lib/telegram.ts` | Telegram API helpers |
| `client/lib/lockers.ts` | Availability query helper |
| `client/app/api/gear-availability/route.ts` | New |
| `client/app/api/gear-submit-id/route.ts` | New |
| `client/app/api/telegram-webhook/route.ts` | New |
| `client/app/api/gear-send-reminder/route.ts` | New |
| `client/app/api/gear-extend/route.ts` | New |
| `client/app/api/gear-checkout/route.ts` | Update — add availability check |
| `client/app/gear/success/page.tsx` | Update — redirect to /gear/verify |
| `client/app/gear/GearRentalClient.tsx` | Update — real-time availability check |
| `client/app/gear/verify/[rentalId]/page.tsx` | New server component |
| `client/app/gear/verify/[rentalId]/VerifyClient.tsx` | New client component |
| `client/app/gear/extend/[rentalId]/page.tsx` | New |
| `client/app/gear/extend/[rentalId]/ExtendClient.tsx` | New |
| `client/app/admin/AdminClient.tsx` | Update — locker inventory tab + extensions |
| `client/app/admin/page.tsx` | Update — fetch lockers data |
| `vercel.json` | New — cron job config |
