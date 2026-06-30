# BoxRetreat — React Migration Phase 1 Design Spec
**Date:** 2026-06-22
**Author:** Claude Code
**Status:** Approved

---

## Overview

Migrate BoxRetreat's vanilla HTML/CSS/JS rental landing page to a production-ready Next.js 14 App Router application, deployed on Vercel with Supabase as the database. Phase 1 covers the main rental page (`/`), the booking widget with pricing bug fixes, the Hero video section, and full Vibra Surf brand application (B&W, Futura, no luxury language). The Express backend is replaced by Next.js API Routes.

---

## 1. Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Vercel-native, SSR for SEO, Server/Client component split |
| Language | TypeScript | Type safety for Supabase schema, Stripe payloads |
| Database | Supabase (existing schema) | Already designed, RLS, Auth built-in |
| Payments | Stripe (existing keys) | Existing integration, migrated to API Routes |
| State | Zustand + persist middleware | Lightweight, no boilerplate, localStorage sync |
| Styling | CSS Modules + globals.css | No runtime overhead, co-located styles, mobile-first |
| Date picker | react-day-picker v8 | Accessible, headless, easy to style B&W |
| Deployment | Vercel | One-command deploy, env vars in dashboard |

---

## 2. Project Structure

```
boxretreat/
├── app/
│   ├── layout.tsx                 # Root layout: Josefin Sans preload + providers
│   ├── page.tsx                   # Server Component: fetches pricing + blocked dates
│   ├── globals.css                # Design tokens, reset, Futura font stack
│   └── api/
│       ├── checkout/
│       │   └── route.ts           # POST — creates Stripe checkout session
│       ├── session/
│       │   └── [id]/route.ts      # GET — verifies Stripe session after redirect
│       └── availability/
│           └── route.ts           # GET — returns blocked dates from Supabase
├── components/
│   ├── layout/
│   │   ├── Nav.tsx                # Sticky mobile nav, hamburger menu
│   │   └── Footer.tsx             # B&W footer, surf cabin copy
│   └── home/
│       ├── Hero.tsx               # Video background + headline + CTA (Client)
│       ├── PropertySection.tsx    # 400 sq ft description, surf cabin copy (Server)
│       ├── AmenitiesSection.tsx   # Icon grid, mobile 2-col (Server)
│       ├── BookingWidget.tsx      # Date picker + guest count + pricing (Client)
│       ├── PricingBreakdown.tsx   # Line-item pricing display (Client)
│       ├── ReviewsSection.tsx     # Guest reviews, no luxury language (Server)
│       ├── LocationSection.tsx    # Map embed + distance copy (Server)
│       └── HostSection.tsx        # Host profile (Server)
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # createBrowserClient — for Client Components
│   │   └── server.ts              # createServerClient — for Server Components + API Routes
│   ├── stripe.ts                  # Stripe server-side instance (secret key)
│   └── pricing.ts                 # Pure pricing calculation — single source of truth
├── store/
│   └── bookingStore.ts            # Zustand store with persist middleware
├── types/
│   └── index.ts                   # Shared TypeScript types (Reservation, Pricing, etc.)
└── public/
    └── video/
        ├── hero-surf.mp4          # User's video file (place here)
        └── hero-poster.jpg        # First frame exported from the .mp4 as JPG (user provides or ffmpeg: `ffmpeg -i hero-surf.mp4 -vframes 1 hero-poster.jpg`)
```

---

## 3. Data Flow

### Server-side (page.tsx — runs on Vercel server, zero client cost)
```
page.tsx
  → supabase/server.ts → pricing_config table → { pricePerNight, cleaningFee, servicePct, taxRate }
  → supabase/server.ts → blocked_dates table  → Date[]
  → renders page with both as props to child components
```

### Client-side (BookingWidget.tsx)
```
User selects dates
  → bookingStore.setDates(checkIn, checkOut)
  → pricing.ts:calculatePricing(nights, config) → PricingBreakdown re-renders
  → User clicks "Reservar"
  → POST /api/checkout { checkIn, checkOut, guests, pricing }
  → API Route validates → creates Stripe session → returns { url }
  → router.push(url) → Stripe hosted checkout
  → Stripe redirects to /success?session_id=xxx
```

---

## 4. Bug Fixes

### Bug 1: Carrito / "Add to Cart" no funciona
**Root cause:** State lives in vanilla JS globals, no reactivity between files.
**Fix:** Zustand `bookingStore` with `persist` middleware. `BookingWidget` reads/writes store. No more globals. The "Reservar" button calls `POST /api/checkout` directly — no intermediate cart state needed for a single-property rental.

### Bug 2: Precios ($$$) incorrectos
**Root cause:** Pricing logic duplicated across `lib/pricing.js`, `lib/fin-calc.js`, `js/rental-booking.js` — inconsistent formulas.
**Fix:** Single `lib/pricing.ts` function:
```typescript
export function calculatePricing(nights: number, config: PricingConfig): PricingResult {
  const subtotal     = nights * config.pricePerNight;
  const cleaningFee  = config.cleaningFee;              // $75 flat
  const serviceFee   = subtotal * config.servicePct;    // 14%
  const taxes        = (subtotal + cleaningFee + serviceFee) * config.taxRate; // 11.5%
  const total        = subtotal + cleaningFee + serviceFee + taxes;
  return { subtotal, cleaningFee, serviceFee, taxes, total, nights };
}
```
This exact function is called in `BookingWidget`, `PricingBreakdown`, and `/api/checkout/route.ts`. No divergence possible.

### Bug 3: Caracteres corruptos (â€", Ã, etc.)
**Root cause:** Files saved/served with wrong encoding, HTML entities not escaped, JS template literals with hardcoded bad chars.
**Fix:** All `.tsx` files saved UTF-8. `layout.tsx` declares `<html lang="es">` with `<meta charset="utf-8">`. All copy rewritten in clean TypeScript string literals — no legacy HTML copy-pasted.

---

## 5. Hero Section — Video Implementation

```tsx
// components/home/Hero.tsx
"use client";

export function Hero() {
  return (
    <section className={styles.hero}>
      <video
        className={styles.video}
        autoPlay
        muted
        loop
        playsInline          // critical for iOS autoplay
        preload="none"       // don't block mobile page load
        poster="/video/hero-poster.jpg"  // instant fallback frame
      >
        <source src="/video/hero-surf.mp4" type="video/mp4" />
      </video>
      <div className={styles.overlay} />
      <div className={styles.content}>
        <p className={styles.eyebrow}>LUQUILLO, PUERTO RICO</p>
        <h1 className={styles.headline}>
          REFUGIO<br />COSTERO
        </h1>
        <p className={styles.sub}>
          Un container convertido a surf cabin.<br />
          A pasos del mar. El Yunque a 15 minutos.
        </p>
        <a href="#booking" className={styles.cta}>RESERVAR AHORA</a>
      </div>
    </section>
  );
}
```

**Mobile performance:** `preload="none"` prevents the browser from downloading the video until needed. The `poster` JPG loads instantly. On slow connections: user sees the poster image (photo of the surf cabin / beach), which is already a great first impression.

---

## 6. Visual Design System

### Color Tokens (globals.css)
```css
:root {
  --black:    #000000;
  --white:    #FFFFFF;
  --gray-90:  #1A1A1A;
  --gray-70:  #4D4D4D;
  --gray-30:  #B3B3B3;
  --gray-10:  #F2F2F2;

  --font: 'Futura', 'Century Gothic', 'Josefin Sans', sans-serif;

  --tracking-hero: 0.12em;
  --tracking-ui:   0.06em;
  --tracking-cap:  0.08em;
}
```

### Typography Scale
| Token | Size | Weight | Use |
|---|---|---|---|
| `--text-hero` | clamp(32px, 8vw, 72px) | 900 | H1 hero headline |
| `--text-h2` | clamp(24px, 5vw, 48px) | 700 | Section titles |
| `--text-h3` | clamp(18px, 3vw, 28px) | 700 | Card titles |
| `--text-body` | 16px / 1.6 | 400 | Body copy |
| `--text-caption` | 12px | 600 | Labels, tags |

### Button Pattern
```css
.btn-primary {
  background: var(--black);
  color: var(--white);
  border: 2px solid var(--black);
  border-radius: 0;
  padding: 14px 32px;
  font-family: var(--font);
  font-weight: 700;
  letter-spacing: var(--tracking-ui);
  text-transform: uppercase;
}
.btn-primary:hover {
  background: transparent;
  color: var(--black);
}
```

### Breakpoints (mobile-first)
```css
/* base: 320px — all default styles are mobile */
@media (min-width: 480px)  { /* sm */ }
@media (min-width: 768px)  { /* md — tablet */ }
@media (min-width: 1024px) { /* lg — desktop */ }
@media (min-width: 1280px) { /* xl — wide */ }
```

---

## 7. Copy Rules (enforced in all components)

**Prohibited:** luxury, lujo, luxurious, premium experience, upscale, high-end
**Required vocabulary:** rústico, orgánico, acogedor, refugio costero, esencia de surf, auténtico, genuino

---

## 8. Environment Variables Required

```bash
# .env.local (never commit)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # server-only, never exposed to client
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_BASE_URL=https://boxretreat.com
```

---

## 9. Out of Scope (Phase 1)

- Shop page (`/shop`) — Phase 2
- Admin portal (`/admin`) — Phase 3
- Account page (`/account`) — Phase 4
- Success page (`/success`) — Phase 4
- Email notifications — future
- i18n (EN/ES toggle) — future

---

## 10. Success Criteria

- [ ] `npm run dev` starts without errors
- [ ] Main page loads in < 3s on mobile (Lighthouse mobile score > 85)
- [ ] Video plays automatically on iOS Safari and Android Chrome
- [ ] Selecting dates shows correct price breakdown (matches DB pricing_config)
- [ ] "Reservar" button creates Stripe session and redirects
- [ ] Zero instances of "luxury/lujo" in rendered output
- [ ] All text renders UTF-8 correctly (no â€", Ã characters)
- [ ] Lighthouse accessibility score > 90
