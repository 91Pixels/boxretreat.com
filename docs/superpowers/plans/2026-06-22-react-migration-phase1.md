# BoxRetreat React Migration — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the BoxRetreat rental landing page from vanilla HTML/JS to a production-ready Next.js 14 App Router app with Supabase, Stripe, hero video, pricing bug fix, and Vibra Surf B&W brand.

**Architecture:** Next.js 14 App Router in `client/` subfolder. `page.tsx` is a Server Component that fetches pricing config and blocked dates from Supabase at request time. `BookingWidget` is a Client Component using Zustand for date/pricing state. Three API Routes replace the Express endpoints for checkout, session verification, and availability.

**Tech Stack:** Next.js 14, TypeScript, CSS Modules, Zustand, @supabase/ssr, Stripe, react-day-picker v8, Vitest

---

## File Map

| File | Responsibility |
|---|---|
| `client/app/layout.tsx` | Root layout: Josefin Sans preload, html lang, providers |
| `client/app/page.tsx` | Server Component: fetch pricing + blocked dates, render all sections |
| `client/app/globals.css` | Design tokens: B&W palette, Futura font stack, reset |
| `client/app/api/availability/route.ts` | GET blocked dates from Supabase |
| `client/app/api/checkout/route.ts` | POST create Stripe checkout session |
| `client/app/api/session/[id]/route.ts` | GET verify Stripe session after redirect |
| `client/components/layout/Nav.tsx` | Sticky mobile nav |
| `client/components/layout/Footer.tsx` | B&W footer, surf copy |
| `client/components/home/Hero.tsx` | Video background + headline + CTA (Client) |
| `client/components/home/PropertySection.tsx` | Description, specs (Server) |
| `client/components/home/AmenitiesSection.tsx` | Icon grid, mobile 2-col (Server) |
| `client/components/home/BookingWidget.tsx` | Date picker + guest counter (Client) |
| `client/components/home/PricingBreakdown.tsx` | Line-item pricing display (Client) |
| `client/components/home/ReviewsSection.tsx` | Guest reviews (Server) |
| `client/components/home/LocationSection.tsx` | Map + distances (Server) |
| `client/components/home/HostSection.tsx` | Host profile (Server) |
| `client/lib/supabase/client.ts` | Supabase browser client |
| `client/lib/supabase/server.ts` | Supabase server client (cookies) |
| `client/lib/stripe.ts` | Stripe server-side instance |
| `client/lib/pricing.ts` | Pure pricing calculation — single source of truth |
| `client/store/bookingStore.ts` | Zustand store with localStorage persist |
| `client/types/index.ts` | Shared TypeScript types |
| `client/__tests__/pricing.test.ts` | Unit tests for pricing.ts |

---

## Task 1: Scaffold Next.js 14 Project

**Files:**
- Create: `client/` (new Next.js project)
- Create: `client/.env.local`
- Create: `client/next.config.ts`

- [ ] **Step 1: Scaffold the project**

Run from `Rental_Vacations/`:
```bash
npx create-next-app@14 client \
  --typescript \
  --no-tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```
When prompted: choose **No** for Tailwind (we use CSS Modules).

- [ ] **Step 2: Install dependencies**

```bash
cd client
npm install zustand @supabase/ssr @supabase/supabase-js stripe react-day-picker
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Configure Vitest**

Create `client/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
});
```

Create `client/vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add test script to package.json**

In `client/package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Configure next.config.ts**

Replace contents of `client/next.config.ts`:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 6: Create .env.local**

Create `client/.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLISHABLE_KEY
NEXT_PUBLIC_BASE_URL=http://localhost:3001
```

Fill in values from your Supabase project dashboard (Settings → API) and Stripe dashboard.

- [ ] **Step 7: Place video file**

Copy your surf video:
```bash
mkdir -p client/public/video
# Copy your hero-surf.mp4 into client/public/video/
# Then extract poster frame (requires ffmpeg):
ffmpeg -i client/public/video/hero-surf.mp4 -vframes 1 client/public/video/hero-poster.jpg
```

- [ ] **Step 8: Verify project starts**

```bash
cd client && npm run dev -- --port 3001
```
Expected: Next.js starts at http://localhost:3001 with default page. No errors in terminal.

- [ ] **Step 9: Commit**

```bash
cd client
git add .
git commit -m "feat: scaffold Next.js 14 App Router project for BoxRetreat Phase 1"
```

---

## Task 2: Shared TypeScript Types

**Files:**
- Create: `client/types/index.ts`

- [ ] **Step 1: Write types**

Create `client/types/index.ts`:
```typescript
export interface PricingConfig {
  pricePerNight: number;
  cleaningFee: number;
  servicePct: number;   // e.g. 0.14
  taxRate: number;      // e.g. 0.115
  minNights: number;
  maxNights: number;
  maxGuests: number;
}

export interface PricingResult {
  nights: number;
  pricePerNight: number;
  subtotal: number;
  cleaningFee: number;
  serviceFee: number;
  taxes: number;
  total: number;
}

export interface BookingState {
  checkIn: string | null;       // ISO date string 'YYYY-MM-DD'
  checkOut: string | null;
  guests: number;
  pricing: PricingResult | null;
  pricingConfig: PricingConfig | null;
  blockedDates: string[];       // ISO date strings
}

export interface Reservation {
  id: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  guestName: string;
  guestEmail: string;
  pricing: PricingResult;
  status: 'confirmed' | 'cancelled' | 'pending';
  stripeSessionId?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: pricing.ts — Single Source of Truth (TDD)

**Files:**
- Create: `client/lib/pricing.ts`
- Create: `client/__tests__/pricing.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `client/__tests__/pricing.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculatePricing, nightsBetween, DEFAULT_CONFIG } from '../lib/pricing';

describe('nightsBetween', () => {
  it('returns 3 for a 3-night stay', () => {
    expect(nightsBetween('2025-07-01', '2025-07-04')).toBe(3);
  });

  it('returns 1 for a 1-night stay', () => {
    expect(nightsBetween('2025-07-01', '2025-07-02')).toBe(1);
  });

  it('returns 0 for same-day', () => {
    expect(nightsBetween('2025-07-01', '2025-07-01')).toBe(0);
  });
});

describe('calculatePricing', () => {
  const config = DEFAULT_CONFIG; // pricePerNight=185, cleaning=75, svc=14%, tax=11.5%

  it('calculates a 3-night stay correctly', () => {
    const result = calculatePricing(3, config);
    // subtotal: 3 × 185 = 555
    // cleaningFee: 75
    // serviceFee: round(555 × 0.14) = 78
    // taxes: round((555 + 75 + 78) × 0.115) = round(708 × 0.115) = round(81.42) = 81
    // total: 555 + 75 + 78 + 81 = 789
    expect(result.nights).toBe(3);
    expect(result.pricePerNight).toBe(185);
    expect(result.subtotal).toBe(555);
    expect(result.cleaningFee).toBe(75);
    expect(result.serviceFee).toBe(78);
    expect(result.taxes).toBe(81);
    expect(result.total).toBe(789);
  });

  it('calculates a 7-night stay correctly', () => {
    const result = calculatePricing(7, config);
    // subtotal: 7 × 185 = 1295
    // serviceFee: round(1295 × 0.14) = 181
    // taxes: round((1295 + 75 + 181) × 0.115) = round(1551 × 0.115) = round(178.365) = 178
    // total: 1295 + 75 + 181 + 178 = 1729
    expect(result.subtotal).toBe(1295);
    expect(result.serviceFee).toBe(181);
    expect(result.taxes).toBe(178);
    expect(result.total).toBe(1729);
  });

  it('returns null for 0 nights', () => {
    expect(calculatePricing(0, config)).toBeNull();
  });

  it('returns null for negative nights', () => {
    expect(calculatePricing(-1, config)).toBeNull();
  });

  it('respects custom pricePerNight override', () => {
    const customConfig = { ...config, pricePerNight: 200 };
    const result = calculatePricing(2, customConfig);
    expect(result?.subtotal).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
npm test
```
Expected: FAIL — "Cannot find module '../lib/pricing'"

- [ ] **Step 3: Implement pricing.ts**

Create `client/lib/pricing.ts`:
```typescript
import type { PricingConfig, PricingResult } from '@/types';

export const DEFAULT_CONFIG: PricingConfig = {
  pricePerNight: 185,
  cleaningFee: 75,
  servicePct: 0.14,
  taxRate: 0.115,
  minNights: 2,
  maxNights: 30,
  maxGuests: 4,
};

export function nightsBetween(checkIn: string, checkOut: string): number {
  const s = new Date(checkIn + 'T12:00:00');
  const e = new Date(checkOut + 'T12:00:00');
  return Math.round((e.getTime() - s.getTime()) / 86_400_000);
}

export function calculatePricing(
  nights: number,
  config: PricingConfig
): PricingResult | null {
  if (!nights || nights <= 0) return null;
  const subtotal    = nights * config.pricePerNight;
  const cleaningFee = config.cleaningFee;
  const serviceFee  = Math.round(subtotal * config.servicePct);
  const taxes       = Math.round((subtotal + cleaningFee + serviceFee) * config.taxRate);
  const total       = subtotal + cleaningFee + serviceFee + taxes;
  return {
    nights,
    pricePerNight: config.pricePerNight,
    subtotal,
    cleaningFee,
    serviceFee,
    taxes,
    total,
  };
}
```

- [ ] **Step 4: Run tests — confirm they PASS**

```bash
npm test
```
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pricing.ts __tests__/pricing.test.ts
git commit -m "feat: add pricing.ts with full test coverage — single source of truth"
```

---

## Task 4: Supabase Clients

**Files:**
- Create: `client/lib/supabase/client.ts`
- Create: `client/lib/supabase/server.ts`

- [ ] **Step 1: Create browser client**

Create `client/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `client/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create Stripe server instance**

Create `client/lib/stripe.ts`:
```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts lib/stripe.ts
git commit -m "feat: add Supabase SSR clients and Stripe server instance"
```

---

## Task 5: Zustand Booking Store

**Files:**
- Create: `client/store/bookingStore.ts`

- [ ] **Step 1: Write the store**

Create `client/store/bookingStore.ts`:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BookingState, PricingConfig, PricingResult } from '@/types';
import { calculatePricing, nightsBetween } from '@/lib/pricing';

interface BookingActions {
  setDates: (checkIn: string, checkOut: string) => void;
  setGuests: (guests: number) => void;
  setPricingConfig: (config: PricingConfig) => void;
  setBlockedDates: (dates: string[]) => void;
  reset: () => void;
}

const initialState: BookingState = {
  checkIn: null,
  checkOut: null,
  guests: 2,
  pricing: null,
  pricingConfig: null,
  blockedDates: [],
};

export const useBookingStore = create<BookingState & BookingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDates: (checkIn, checkOut) => {
        const { pricingConfig } = get();
        let pricing: PricingResult | null = null;
        if (pricingConfig && checkIn && checkOut) {
          const nights = nightsBetween(checkIn, checkOut);
          pricing = calculatePricing(nights, pricingConfig);
        }
        set({ checkIn, checkOut, pricing });
      },

      setGuests: (guests) => set({ guests }),

      setPricingConfig: (config) => set({ pricingConfig: config }),

      setBlockedDates: (dates) => set({ blockedDates: dates }),

      reset: () => set(initialState),
    }),
    {
      name: 'br-booking',
      partialize: (state) => ({
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        guests: state.guests,
      }),
    }
  )
);
```

- [ ] **Step 2: Commit**

```bash
git add store/bookingStore.ts
git commit -m "feat: add Zustand booking store with persist middleware"
```

---

## Task 6: Design System — globals.css

**Files:**
- Modify: `client/app/globals.css`

- [ ] **Step 1: Replace globals.css completely**

Replace the entire contents of `client/app/globals.css`:
```css
/* =====================================================
   BoxRetreat Design System — Vibra Surf B&W
   Mobile-first. Futura. Zero luxury.
===================================================== */

@import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600;700&display=swap');

/* ── Tokens ── */
:root {
  --black:    #000000;
  --white:    #FFFFFF;
  --gray-90:  #1A1A1A;
  --gray-70:  #4D4D4D;
  --gray-50:  #808080;
  --gray-30:  #B3B3B3;
  --gray-10:  #F2F2F2;
  --gray-05:  #F7F7F7;

  --font: 'Futura', 'Century Gothic', 'Josefin Sans', sans-serif;

  --tracking-hero: 0.12em;
  --tracking-h2:   0.06em;
  --tracking-ui:   0.06em;
  --tracking-cap:  0.08em;

  --max-w: 1200px;
  --gutter-mobile: 20px;
  --gutter-desktop: 48px;
}

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; scroll-behavior: smooth; }
body {
  font-family: var(--font);
  color: var(--black);
  background: var(--white);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
img, video { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
button { font-family: var(--font); cursor: pointer; }

/* ── Typography scale ── */
h1 { font-size: clamp(32px, 8vw, 72px); font-weight: 900; letter-spacing: var(--tracking-hero); line-height: 1; }
h2 { font-size: clamp(24px, 5vw, 48px); font-weight: 700; letter-spacing: var(--tracking-h2); }
h3 { font-size: clamp(18px, 3vw, 28px); font-weight: 700; }
p  { font-size: 16px; line-height: 1.65; color: var(--gray-70); }

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--black);
  color: var(--white);
  border: 2px solid var(--black);
  border-radius: 0;
  padding: 14px 32px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: var(--tracking-ui);
  text-transform: uppercase;
  transition: background 0.15s, color 0.15s;
}
.btn-primary:hover {
  background: transparent;
  color: var(--black);
}
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--black);
  border: 2px solid var(--black);
  border-radius: 0;
  padding: 14px 32px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: var(--tracking-ui);
  text-transform: uppercase;
  transition: background 0.15s, color 0.15s;
}
.btn-ghost:hover {
  background: var(--black);
  color: var(--white);
}

/* ── Layout helpers ── */
.container {
  width: 100%;
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--gutter-mobile);
}
@media (min-width: 1024px) {
  .container { padding: 0 var(--gutter-desktop); }
}

/* ── Caption label ── */
.eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: var(--tracking-cap);
  text-transform: uppercase;
  color: var(--gray-50);
}

/* ── Section spacing ── */
.section { padding: 64px 0; }
@media (min-width: 1024px) { .section { padding: 96px 0; } }
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: implement Vibra Surf B&W design system in globals.css"
```

---

## Task 7: Root Layout

**Files:**
- Modify: `client/app/layout.tsx`

- [ ] **Step 1: Write layout.tsx**

Replace `client/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BoxRetreat — Surf Cabin · Luquillo, Puerto Rico',
  description: 'Refugio costero rústico en container. A pasos del surf. El Yunque a 15 minutos.',
  openGraph: {
    title: 'BoxRetreat — Surf Cabin · Luquillo, Puerto Rico',
    description: 'Un container convertido a surf cabin. Orgánico, auténtico, acogedor.',
    images: ['/video/hero-poster.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: root layout with UTF-8, lang=es, Josefin Sans preconnect"
```

---

## Task 8: Nav Component

**Files:**
- Create: `client/components/layout/Nav.tsx`
- Create: `client/components/layout/Nav.module.css`

- [ ] **Step 1: Write Nav.tsx**

Create `client/components/layout/Nav.tsx`:
```tsx
'use client';
import { useState, useEffect } from 'react';
import styles from './Nav.module.css';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        <a href="/" className={styles.logo}>
          Box<span>Retreat</span>
        </a>

        <button
          className={styles.hamburger}
          onClick={() => setOpen(!open)}
          aria-label="Menú"
          aria-expanded={open}
        >
          <span />
          <span />
          <span />
        </button>

        <div className={`${styles.links} ${open ? styles.linksOpen : ''}`}>
          <a href="#property" onClick={() => setOpen(false)}>La Cabaña</a>
          <a href="#amenities" onClick={() => setOpen(false)}>Amenidades</a>
          <a href="#reviews" onClick={() => setOpen(false)}>Reseñas</a>
          <a href="#booking" onClick={() => setOpen(false)} className={styles.ctaLink}>Reservar</a>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Write Nav.module.css**

Create `client/components/layout/Nav.module.css`:
```css
.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: transparent;
  transition: background 0.25s, border-bottom 0.25s;
}
.scrolled {
  background: var(--white);
  border-bottom: 1px solid var(--black);
}
.inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 16px 20px;
}
.logo {
  font-family: var(--font);
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--white);
  transition: color 0.25s;
}
.scrolled .logo { color: var(--black); }
.logo span { color: inherit; }

/* Desktop links */
.links {
  display: none;
  gap: 32px;
  align-items: center;
}
.links a {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: var(--tracking-cap);
  text-transform: uppercase;
  color: var(--white);
  transition: opacity 0.15s;
}
.links a:hover { opacity: 0.65; }
.scrolled .links a { color: var(--black); }
.ctaLink {
  border: 2px solid var(--white) !important;
  padding: 8px 20px;
}
.scrolled .ctaLink {
  border-color: var(--black) !important;
}

@media (min-width: 768px) {
  .links { display: flex; }
  .hamburger { display: none; }
}

/* Hamburger */
.hamburger {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
}
.hamburger span {
  display: block;
  width: 24px;
  height: 2px;
  background: var(--white);
  transition: background 0.25s;
}
.scrolled .hamburger span { background: var(--black); }

/* Mobile menu open */
@media (max-width: 767px) {
  .links {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--black);
    align-items: center;
    justify-content: center;
    gap: 40px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }
  .linksOpen {
    transform: translateX(0);
  }
  .links a {
    font-size: 20px;
    color: var(--white) !important;
  }
  .ctaLink {
    border-color: var(--white) !important;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/Nav.tsx components/layout/Nav.module.css
git commit -m "feat: Nav component — mobile hamburger + desktop sticky"
```

---

## Task 9: Hero Component (Video Background)

**Files:**
- Create: `client/components/home/Hero.tsx`
- Create: `client/components/home/Hero.module.css`

- [ ] **Step 1: Write Hero.tsx**

Create `client/components/home/Hero.tsx`:
```tsx
'use client';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.hero} id="hero">
      <video
        className={styles.video}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster="/video/hero-poster.jpg"
      >
        <source src="/video/hero-surf.mp4" type="video/mp4" />
      </video>
      <div className={styles.overlay} />

      <div className={styles.content}>
        <p className={`${styles.eyebrow} eyebrow`}>LUQUILLO · PUERTO RICO</p>
        <h1 className={styles.headline}>
          REFUGIO<br />COSTERO
        </h1>
        <p className={styles.sub}>
          Un container convertido a surf cabin.<br />
          A pasos del mar. El Yunque a 15 minutos.
        </p>
        <div className={styles.actions}>
          <a href="#booking" className="btn-primary">
            Reservar Ahora
          </a>
          <a href="#property" className="btn-ghost" style={{ borderColor: 'white', color: 'white' }}>
            Ver la Cabaña
          </a>
        </div>
      </div>

      <div className={styles.scroll}>
        <span>SCROLL</span>
        <div className={styles.scrollLine} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write Hero.module.css**

Create `client/components/home/Hero.module.css`:
```css
.hero {
  position: relative;
  width: 100%;
  height: 100svh;         /* svh = small viewport height, avoids mobile browser chrome */
  min-height: 600px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  z-index: 0;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1;
}
@media (min-width: 768px)  { .overlay { background: rgba(0,0,0,0.45); } }
@media (min-width: 1024px) { .overlay { background: rgba(0,0,0,0.38); } }

.content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 0 24px;
  max-width: 800px;
  color: var(--white);
}

.eyebrow {
  color: rgba(255,255,255,0.7);
  margin-bottom: 16px;
}

.headline {
  color: var(--white);
  margin-bottom: 20px;
  text-transform: uppercase;
}

.sub {
  font-size: 16px;
  color: rgba(255,255,255,0.85);
  line-height: 1.7;
  margin-bottom: 36px;
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
}
@media (min-width: 768px) { .sub { font-size: 18px; } }

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Scroll indicator */
.scroll {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(255,255,255,0.5);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
}
.scrollLine {
  width: 1px;
  height: 40px;
  background: rgba(255,255,255,0.4);
  animation: scrollPulse 2s ease-in-out infinite;
}
@keyframes scrollPulse {
  0%, 100% { opacity: 0.4; transform: scaleY(1); }
  50% { opacity: 1; transform: scaleY(1.3); }
}
@media (max-width: 480px) { .scroll { display: none; } }
```

- [ ] **Step 3: Commit**

```bash
git add components/home/Hero.tsx components/home/Hero.module.css
git commit -m "feat: Hero component with video background, mobile-first, iOS playsInline"
```

---

## Task 10: PropertySection + AmenitiesSection

**Files:**
- Create: `client/components/home/PropertySection.tsx`
- Create: `client/components/home/PropertySection.module.css`
- Create: `client/components/home/AmenitiesSection.tsx`
- Create: `client/components/home/AmenitiesSection.module.css`

- [ ] **Step 1: Write PropertySection.tsx**

Create `client/components/home/PropertySection.tsx`:
```tsx
import styles from './PropertySection.module.css';

const IMAGES = [
  { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop', alt: 'Container exterior' },
  { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', alt: 'Living space' },
  { url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&h=600&fit=crop', alt: 'Bedroom' },
  { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop', alt: 'Deck at sunset' },
  { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Kitchen' },
];

const SPECS = [
  { label: 'TAMAÑO', value: '400 sq ft' },
  { label: 'HUÉSPEDES', value: 'Hasta 4' },
  { label: 'HABITACIONES', value: '1 Cuarto' },
  { label: 'BAÑOS', value: '1 Baño' },
  { label: 'CHECK-IN', value: '3:00 PM' },
  { label: 'CHECK-OUT', value: '11:00 AM' },
];

export function PropertySection() {
  return (
    <section className={`section ${styles.section}`} id="property">
      <div className="container">
        <div className={styles.grid}>
          {/* Text */}
          <div className={styles.text}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>LA CABAÑA</p>
            <h2 style={{ marginBottom: 20 }}>Rústico por diseño,<br />orgánico por naturaleza</h2>
            <p style={{ marginBottom: 16 }}>
              400 sq ft de esencia surfera auténtica en Luquillo, Puerto Rico.
              Este container reciclado fue transformado en un refugio costero acogedor,
              orgánico y sin pretensiones — diseñado para quienes vienen a surfear,
              explorar El Yunque y desconectarse del ruido.
            </p>
            <p style={{ marginBottom: 32 }}>
              Ventanas de piso a techo enmarcan palmas y montañas. Despierta al
              coquí, toma café en la terraza y llega a la playa en minutos.
            </p>
            <div className={styles.specs}>
              {SPECS.map(({ label, value }) => (
                <div key={label} className={styles.spec}>
                  <span className="eyebrow">{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Gallery grid */}
          <div className={styles.gallery}>
            <div className={styles.galleryMain}>
              <img src={IMAGES[0].url} alt={IMAGES[0].alt} />
            </div>
            <div className={styles.gallerySide}>
              {IMAGES.slice(1, 5).map((img) => (
                <img key={img.url} src={img.url} alt={img.alt} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write PropertySection.module.css**

Create `client/components/home/PropertySection.module.css`:
```css
.section { border-top: 1px solid var(--gray-10); }

.grid {
  display: flex;
  flex-direction: column;
  gap: 48px;
}
@media (min-width: 1024px) {
  .grid { flex-direction: row; align-items: flex-start; gap: 64px; }
  .text { flex: 1; }
  .gallery { flex: 1; }
}

.specs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  border-top: 1px solid var(--gray-10);
  padding-top: 24px;
}
@media (min-width: 480px) { .specs { grid-template-columns: repeat(3, 1fr); } }

.spec {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.spec strong { font-size: 15px; font-weight: 700; }

.galleryMain img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  display: block;
}
.gallerySide {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  margin-top: 4px;
}
.gallerySide img {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  display: block;
}
```

- [ ] **Step 3: Write AmenitiesSection.tsx**

Create `client/components/home/AmenitiesSection.tsx`:
```tsx
import styles from './AmenitiesSection.module.css';

const AMENITIES = [
  { icon: '📶', label: 'WiFi · 300 Mbps' },
  { icon: '❄️', label: 'Aire acondicionado' },
  { icon: '📺', label: 'Smart TV · Netflix/HBO' },
  { icon: '🍳', label: 'Cocina equipada' },
  { icon: '🚗', label: 'Estacionamiento gratis' },
  { icon: '🚿', label: 'Ducha de lluvia' },
  { icon: '☕', label: 'Estación de café' },
  { icon: '🏖️', label: 'Toallas y sillas de playa' },
  { icon: '🔥', label: 'BBQ al aire libre' },
  { icon: '🌴', label: 'Terraza & hamaca privada' },
];

export function AmenitiesSection() {
  return (
    <section className={`section ${styles.section}`} id="amenities">
      <div className="container">
        <p className="eyebrow" style={{ marginBottom: 12 }}>AMENIDADES</p>
        <h2 style={{ marginBottom: 40 }}>Todo lo que necesitas,<br />nada que no</h2>
        <div className={styles.grid}>
          {AMENITIES.map(({ icon, label }) => (
            <div key={label} className={styles.item}>
              <span className={styles.icon}>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write AmenitiesSection.module.css**

Create `client/components/home/AmenitiesSection.module.css`:
```css
.section { background: var(--gray-05); }

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (min-width: 640px)  { .grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1024px) { .grid { grid-template-columns: repeat(5, 1fr); } }

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--gray-10);
  background: var(--white);
  font-size: 13px;
  font-weight: 600;
}
.icon { font-size: 20px; flex-shrink: 0; }
```

- [ ] **Step 5: Commit**

```bash
git add components/home/PropertySection.tsx components/home/PropertySection.module.css \
        components/home/AmenitiesSection.tsx components/home/AmenitiesSection.module.css
git commit -m "feat: PropertySection + AmenitiesSection — surf cabin copy, mobile 2-col grid"
```

---

## Task 11: BookingWidget + PricingBreakdown (Bug Fix)

**Files:**
- Create: `client/components/home/BookingWidget.tsx`
- Create: `client/components/home/BookingWidget.module.css`
- Create: `client/components/home/PricingBreakdown.tsx`
- Create: `client/components/home/PricingBreakdown.module.css`

- [ ] **Step 1: Write PricingBreakdown.tsx**

Create `client/components/home/PricingBreakdown.tsx`:
```tsx
import type { PricingResult } from '@/types';
import styles from './PricingBreakdown.module.css';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

interface Props {
  pricing: PricingResult;
}

export function PricingBreakdown({ pricing }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span>{fmt(pricing.pricePerNight)} × {pricing.nights} {pricing.nights === 1 ? 'noche' : 'noches'}</span>
        <span>{fmt(pricing.subtotal)}</span>
      </div>
      <div className={styles.row}>
        <span>Limpieza</span>
        <span>{fmt(pricing.cleaningFee)}</span>
      </div>
      <div className={styles.row}>
        <span>Cargo por servicio</span>
        <span>{fmt(pricing.serviceFee)}</span>
      </div>
      <div className={styles.row}>
        <span>Impuestos (11.5%)</span>
        <span>{fmt(pricing.taxes)}</span>
      </div>
      <div className={`${styles.row} ${styles.total}`}>
        <span>Total</span>
        <span>{fmt(pricing.total)}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write PricingBreakdown.module.css**

Create `client/components/home/PricingBreakdown.module.css`:
```css
.wrap {
  border-top: 1px solid var(--gray-10);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--gray-70);
}
.total {
  border-top: 1px solid var(--black);
  padding-top: 12px;
  font-weight: 700;
  font-size: 16px;
  color: var(--black);
}
```

- [ ] **Step 3: Write BookingWidget.tsx**

Create `client/components/home/BookingWidget.tsx`:
```tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useBookingStore } from '@/store/bookingStore';
import type { PricingConfig } from '@/types';
import { PricingBreakdown } from './PricingBreakdown';
import styles from './BookingWidget.module.css';
import { nightsBetween } from '@/lib/pricing';

interface Props {
  pricingConfig: PricingConfig;
  blockedDates: string[];
}

export function BookingWidget({ pricingConfig, blockedDates }: Props) {
  const router = useRouter();
  const {
    checkIn, checkOut, guests, pricing,
    setDates, setGuests, setPricingConfig, setBlockedDates,
  } = useBookingStore();

  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Seed store with server-fetched config on first render
  useEffect(() => {
    setPricingConfig(pricingConfig);
    setBlockedDates(blockedDates);
  }, [pricingConfig, blockedDates, setPricingConfig, setBlockedDates]);

  const disabledDays = blockedDates.map((d) => new Date(d + 'T12:00:00'));
  const selected = checkIn && checkOut
    ? { from: new Date(checkIn + 'T12:00:00'), to: new Date(checkOut + 'T12:00:00') }
    : undefined;

  function handleSelect(range: { from?: Date; to?: Date } | undefined) {
    if (!range?.from) return;
    const ci = range.from.toISOString().split('T')[0];
    const co = range.to ? range.to.toISOString().split('T')[0] : ci;
    if (ci !== co) {
      setDates(ci, co);
      setShowCalendar(false);
    }
  }

  async function handleReserve() {
    if (!checkIn || !checkOut || !pricing) {
      setError('Selecciona las fechas para continuar.');
      return;
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < pricingConfig.minNights) {
      setError(`Mínimo ${pricingConfig.minNights} noches.`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkIn, checkOut, guests, pricing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando sesión');
      router.push(data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const nightsCount = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  return (
    <div className={styles.widget} id="booking">
      <div className={styles.header}>
        <div>
          <span className={styles.price}>${pricingConfig.pricePerNight}</span>
          <span className={styles.perNight}> / noche</span>
        </div>
        <div className={styles.rating}>
          ★ 4.97 · <span className={styles.reviews}>83 reseñas</span>
        </div>
      </div>

      {/* Date selector */}
      <div className={styles.dateRow} onClick={() => setShowCalendar(!showCalendar)}>
        <div className={styles.dateBox}>
          <p className="eyebrow" style={{ marginBottom: 2 }}>CHECK-IN</p>
          <p className={styles.dateVal}>{checkIn || 'Agregar fecha'}</p>
        </div>
        <div className={styles.dateDivider} />
        <div className={styles.dateBox}>
          <p className="eyebrow" style={{ marginBottom: 2 }}>CHECK-OUT</p>
          <p className={styles.dateVal}>{checkOut || 'Agregar fecha'}</p>
        </div>
      </div>

      {showCalendar && (
        <div className={styles.calendarWrap}>
          <DayPicker
            mode="range"
            selected={selected}
            onSelect={handleSelect as Parameters<typeof DayPicker>[0]['onSelect']}
            disabled={[{ before: new Date() }, ...disabledDays]}
            numberOfMonths={1}
          />
        </div>
      )}

      {/* Guest counter */}
      <div className={styles.guestRow}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 2 }}>HUÉSPEDES</p>
          <p className={styles.dateVal}>{guests} {guests === 1 ? 'huésped' : 'huéspedes'}</p>
        </div>
        <div className={styles.counter}>
          <button onClick={() => setGuests(Math.max(1, guests - 1))}>−</button>
          <span>{guests}</span>
          <button onClick={() => setGuests(Math.min(pricingConfig.maxGuests, guests + 1))}>+</button>
        </div>
      </div>

      {/* Pricing breakdown — only shown when dates are selected */}
      {pricing && nightsCount >= 2 && (
        <PricingBreakdown pricing={pricing} />
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button
        className={`btn-primary ${styles.reserveBtn}`}
        onClick={handleReserve}
        disabled={loading}
      >
        {loading ? 'Procesando...' : (checkIn && checkOut ? 'Reservar' : 'Verificar disponibilidad')}
      </button>

      {checkIn && checkOut && pricing && (
        <p className={styles.noCharge}>No se hace ningún cargo todavía</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write BookingWidget.module.css**

Create `client/components/home/BookingWidget.module.css`:
```css
.widget {
  border: 1px solid var(--black);
  padding: 24px;
  background: var(--white);
  position: sticky;
  top: 88px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--gray-10);
}
.price { font-size: 24px; font-weight: 900; }
.perNight { font-size: 14px; color: var(--gray-70); }
.rating { font-size: 13px; font-weight: 700; }
.reviews { font-weight: 400; color: var(--gray-70); text-decoration: underline; }

.dateRow {
  display: flex;
  border: 1px solid var(--black);
  cursor: pointer;
  margin-bottom: 8px;
  user-select: none;
}
.dateBox {
  flex: 1;
  padding: 12px;
}
.dateDivider {
  width: 1px;
  background: var(--black);
}
.dateVal { font-size: 13px; font-weight: 600; }

.calendarWrap {
  border: 1px solid var(--black);
  border-top: none;
  padding: 12px;
  margin-bottom: 8px;
  overflow-x: auto;
}
/* Override react-day-picker defaults to match B&W theme */
.calendarWrap :global(.rdp-day_selected) {
  background: var(--black) !important;
  color: var(--white) !important;
  border-radius: 0 !important;
}
.calendarWrap :global(.rdp-day_range_middle) {
  background: var(--gray-10) !important;
  color: var(--black) !important;
  border-radius: 0 !important;
}
.calendarWrap :global(.rdp-button:hover:not([disabled])) {
  background: var(--gray-10) !important;
  border-radius: 0 !important;
}

.guestRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--black);
  padding: 12px;
  margin-bottom: 16px;
}
.counter {
  display: flex;
  align-items: center;
  gap: 16px;
  font-weight: 700;
}
.counter button {
  width: 32px;
  height: 32px;
  border: 1px solid var(--black);
  background: none;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
}
.counter button:hover { background: var(--black); color: var(--white); }

.reserveBtn {
  width: 100%;
  justify-content: center;
  margin-top: 16px;
  font-size: 14px;
  padding: 16px;
}
.reserveBtn:disabled { opacity: 0.5; cursor: not-allowed; }

.error {
  color: #cc0000;
  font-size: 13px;
  margin-top: 8px;
}
.noCharge {
  text-align: center;
  font-size: 12px;
  color: var(--gray-50);
  margin-top: 8px;
}
```

- [ ] **Step 5: Commit**

```bash
git add components/home/BookingWidget.tsx components/home/BookingWidget.module.css \
        components/home/PricingBreakdown.tsx components/home/PricingBreakdown.module.css
git commit -m "fix: BookingWidget with Zustand state, PricingBreakdown with single pricing.ts source"
```

---

## Task 12: ReviewsSection + LocationSection + HostSection

**Files:**
- Create: `client/components/home/ReviewsSection.tsx`
- Create: `client/components/home/ReviewsSection.module.css`
- Create: `client/components/home/LocationSection.tsx`
- Create: `client/components/home/LocationSection.module.css`
- Create: `client/components/home/HostSection.tsx`
- Create: `client/components/home/HostSection.module.css`

- [ ] **Step 1: Write ReviewsSection.tsx**

Create `client/components/home/ReviewsSection.tsx`:
```tsx
import styles from './ReviewsSection.module.css';

const REVIEWS = [
  {
    name: 'Sarah M.',
    flag: '🇺🇸',
    date: 'Enero 2025',
    text: 'El lugar es increíble — auténtico, acogedor, a metros del agua. El diseño del container es ingenioso y la terraza con hamaca es perfecta para ver el atardecer. Volveríamos sin dudarlo.',
    rating: 5,
  },
  {
    name: 'David K.',
    flag: '🇩🇪',
    date: 'Diciembre 2024',
    text: 'Un refugio costero único en su tipo. El espacio se siente genuino y acogedor — exactamente lo que buscábamos para desconectarnos. Michael fue súper atento con recomendaciones locales.',
    rating: 5,
  },
  {
    name: 'Ana R.',
    flag: '🇵🇷',
    date: 'Noviembre 2024',
    text: 'Perfecta base para surfear. 5 minutos a la playa, El Yunque a 15. El container tiene todo lo necesario sin excesos. Rústico pero con carácter — exactamente lo que esperaba.',
    rating: 5,
  },
];

export function ReviewsSection() {
  return (
    <section className={`section ${styles.section}`} id="reviews">
      <div className="container">
        <p className="eyebrow" style={{ marginBottom: 12 }}>RESEÑAS</p>
        <div className={styles.header}>
          <h2>★ 4.97 · 83 reseñas</h2>
          <span className={styles.superhost}>SUPERHOST</span>
        </div>
        <div className={styles.grid}>
          {REVIEWS.map((r) => (
            <div key={r.name} className={styles.card}>
              <div className={styles.stars}>{'★'.repeat(r.rating)}</div>
              <p className={styles.text}>"{r.text}"</p>
              <div className={styles.author}>
                <span className={styles.flag}>{r.flag}</span>
                <div>
                  <p className={styles.name}>{r.name}</p>
                  <p className={styles.date}>{r.date}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write ReviewsSection.module.css**

Create `client/components/home/ReviewsSection.module.css`:
```css
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}
.superhost {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  border: 1.5px solid var(--black);
  padding: 4px 10px;
}
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (min-width: 768px)  { .grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .grid { grid-template-columns: repeat(3, 1fr); } }
.card {
  border: 1px solid var(--gray-10);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.stars { color: var(--black); font-size: 14px; letter-spacing: 2px; }
.text { font-size: 14px; line-height: 1.7; color: var(--gray-70); flex: 1; }
.author { display: flex; align-items: center; gap: 12px; }
.flag { font-size: 24px; }
.name { font-weight: 700; font-size: 14px; }
.date { font-size: 12px; color: var(--gray-50); }
```

- [ ] **Step 3: Write LocationSection.tsx**

Create `client/components/home/LocationSection.tsx`:
```tsx
import styles from './LocationSection.module.css';

const DISTANCES = [
  { place: 'Playa de Luquillo', dist: '5 min', icon: '🏄' },
  { place: 'El Yunque', dist: '15 min', icon: '🌿' },
  { place: 'Kioscos de Luquillo', dist: '3 min', icon: '🍽️' },
  { place: 'Aeropuerto SJU', dist: '45 min', icon: '✈️' },
  { place: 'Old San Juan', dist: '55 min', icon: '🏙️' },
  { place: 'La Pared Surf Spot', dist: '8 min', icon: '🌊' },
];

export function LocationSection() {
  return (
    <section className={`section ${styles.section}`} id="location">
      <div className="container">
        <p className="eyebrow" style={{ marginBottom: 12 }}>UBICACIÓN</p>
        <h2 style={{ marginBottom: 40 }}>Luquillo, Puerto Rico</h2>
        <div className={styles.grid}>
          <div className={styles.map}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15092.45!2d-65.72!3d18.37!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8c03695ae5d6c4b5%3A0x6b1e0e73d0c92b8a!2sLuquillo%2C+Puerto+Rico!5e0!3m2!1sen!2sus!4v1234567890"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="BoxRetreat location in Luquillo, PR"
            />
          </div>
          <div className={styles.distances}>
            {DISTANCES.map(({ place, dist, icon }) => (
              <div key={place} className={styles.distRow}>
                <span className={styles.distIcon}>{icon}</span>
                <span className={styles.distPlace}>{place}</span>
                <span className={styles.distTime}>{dist}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write LocationSection.module.css**

Create `client/components/home/LocationSection.module.css`:
```css
.section { background: var(--gray-05); }
.grid {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
@media (min-width: 1024px) {
  .grid { flex-direction: row; align-items: flex-start; }
  .map { flex: 1.2; }
  .distances { flex: 1; }
}
.map {
  width: 100%;
  height: 320px;
  border: 1px solid var(--black);
  overflow: hidden;
}
@media (min-width: 1024px) { .map { height: 400px; } }
.distances { display: flex; flex-direction: column; gap: 0; }
.distRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--gray-10);
}
.distRow:first-child { border-top: 1px solid var(--gray-10); }
.distIcon { font-size: 20px; width: 28px; text-align: center; flex-shrink: 0; }
.distPlace { flex: 1; font-size: 14px; font-weight: 600; }
.distTime { font-size: 13px; color: var(--gray-70); font-weight: 700; }
```

- [ ] **Step 5: Write HostSection.tsx**

Create `client/components/home/HostSection.tsx`:
```tsx
import styles from './HostSection.module.css';

export function HostSection() {
  return (
    <section className={`section ${styles.section}`} id="host">
      <div className="container">
        <div className={styles.grid}>
          <div className={styles.profile}>
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face"
              alt="Michael, host"
              className={styles.avatar}
            />
            <div>
              <h3>Anfitrión: Michael</h3>
              <p className={styles.since}>Superhost desde marzo 2022</p>
            </div>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}><strong>83</strong><span>Reseñas</span></div>
            <div className={styles.stat}><strong>4.97</strong><span>Calificación</span></div>
            <div className={styles.stat}><strong>99%</strong><span>Respuesta</span></div>
          </div>
          <p className={styles.bio}>
            Hola, soy Michael, puertorriqueño de corazón. BoxRetreat es mi proyecto de pasión —
            un espacio diseñado para que experimentes la belleza auténtica de Luquillo:
            el surf, El Yunque, la gastronomía local y la tranquilidad del mar.
            Siempre disponible para recomendaciones y lo que necesites.
          </p>
          <a href="https://wa.me/17872345678" className={`btn-primary ${styles.contactBtn}`} target="_blank" rel="noopener noreferrer">
            Contactar al anfitrión
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Write HostSection.module.css**

Create `client/components/home/HostSection.module.css`:
```css
.grid { display: flex; flex-direction: column; gap: 24px; max-width: 680px; }
.profile { display: flex; align-items: center; gap: 20px; }
.avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid var(--black); }
.since { font-size: 13px; color: var(--gray-70); margin-top: 4px; }
.stats { display: flex; gap: 32px; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat strong { font-size: 22px; font-weight: 900; }
.stat span { font-size: 12px; color: var(--gray-70); text-transform: uppercase; letter-spacing: 0.06em; }
.bio { font-size: 15px; line-height: 1.75; color: var(--gray-70); }
.contactBtn { align-self: flex-start; }
```

- [ ] **Step 7: Commit**

```bash
git add components/home/ReviewsSection.tsx components/home/ReviewsSection.module.css \
        components/home/LocationSection.tsx components/home/LocationSection.module.css \
        components/home/HostSection.tsx components/home/HostSection.module.css
git commit -m "feat: ReviewsSection, LocationSection, HostSection — surf cabin copy, no luxury language"
```

---

## Task 13: Footer

**Files:**
- Create: `client/components/layout/Footer.tsx`
- Create: `client/components/layout/Footer.module.css`

- [ ] **Step 1: Write Footer.tsx**

Create `client/components/layout/Footer.tsx`:
```tsx
import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <p className={styles.logo}>BoxRetreat</p>
          <p className={styles.tagline}>Refugio costero rústico en container.<br />Luquillo, Puerto Rico.</p>
        </div>
        <div className={styles.links}>
          <a href="#property">La Cabaña</a>
          <a href="#amenities">Amenidades</a>
          <a href="#reviews">Reseñas</a>
          <a href="#booking">Reservar</a>
        </div>
        <div className={styles.legal}>
          <p>© {new Date().getFullYear()} BoxRetreat. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Write Footer.module.css**

Create `client/components/layout/Footer.module.css`:
```css
.footer {
  background: var(--black);
  color: var(--white);
  padding: 48px 0 32px;
}
.inner {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
@media (min-width: 768px) {
  .inner { flex-direction: row; align-items: flex-start; justify-content: space-between; }
}
.logo {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.tagline { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.6; }
.links {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.links a {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.75);
  transition: color 0.15s;
}
.links a:hover { color: var(--white); }
.legal { font-size: 11px; color: rgba(255,255,255,0.4); }
```

- [ ] **Step 3: Commit**

```bash
git add components/layout/Footer.tsx components/layout/Footer.module.css
git commit -m "feat: Footer — B&W, surf cabin copy"
```

---

## Task 14: API Routes

**Files:**
- Create: `client/app/api/availability/route.ts`
- Create: `client/app/api/checkout/route.ts`
- Create: `client/app/api/session/[id]/route.ts`

- [ ] **Step 1: Write availability route**

Create `client/app/api/availability/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('date')
      .gte('date', new Date().toISOString().split('T')[0]);

    if (error) throw error;
    const dates = (data ?? []).map((row: { date: string }) => row.date);
    return NextResponse.json({ dates });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write checkout route**

Create `client/app/api/checkout/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { calculatePricing, nightsBetween, DEFAULT_CONFIG } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checkIn, checkOut, guests } = body;

    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: 'Missing dates' }, { status: 400 });
    }

    // Get live pricing from Supabase (server-authoritative, not trusting client)
    const supabase = await createClient();
    const { data: configRows } = await supabase
      .from('pricing_config')
      .select('key, value');

    const configMap = Object.fromEntries(
      (configRows ?? []).map((r: { key: string; value: string }) => [r.key, parseFloat(r.value)])
    );

    const config = {
      ...DEFAULT_CONFIG,
      pricePerNight: configMap.price_per_night ?? DEFAULT_CONFIG.pricePerNight,
      cleaningFee: configMap.cleaning_fee ?? DEFAULT_CONFIG.cleaningFee,
      servicePct: (configMap.service_fee_pct ?? 14) / 100,
      taxRate: configMap.tax_rate ?? DEFAULT_CONFIG.taxRate,
    };

    const nights = nightsBetween(checkIn, checkOut);
    const pricing = calculatePricing(nights, config);

    if (!pricing) {
      return NextResponse.json({ error: 'Invalid stay duration' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
    const bookingId = `BR-${Date.now().toString(36).toUpperCase()}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `BoxRetreat — Surf Cabin · ${nights} ${nights === 1 ? 'noche' : 'noches'}`,
              description: `Check-in: ${checkIn} · Check-out: ${checkOut} · ${guests} huéspedes`,
            },
            unit_amount: Math.round(pricing.total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?cancelled=1`,
      metadata: {
        bookingId,
        checkIn,
        checkOut,
        nights: String(nights),
        guests: String(guests),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    console.error('Checkout error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Write session verification route**

Create `client/app/api/session/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await stripe.checkout.sessions.retrieve(params.id);
    return NextResponse.json({
      status: session.payment_status,
      customer_email: session.customer_details?.email ?? '',
      amount_total: session.amount_total,
      metadata: session.metadata,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Session not found' },
      { status: 404 }
    );
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/
git commit -m "feat: API routes — availability (Supabase), checkout (Stripe server-auth pricing), session verify"
```

---

## Task 15: Main Page (Server Component Orchestration)

**Files:**
- Modify: `client/app/page.tsx`

- [ ] **Step 1: Write page.tsx**

Replace `client/app/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server';
import { DEFAULT_CONFIG } from '@/lib/pricing';
import type { PricingConfig } from '@/types';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { PropertySection } from '@/components/home/PropertySection';
import { AmenitiesSection } from '@/components/home/AmenitiesSection';
import { BookingWidget } from '@/components/home/BookingWidget';
import { ReviewsSection } from '@/components/home/ReviewsSection';
import { LocationSection } from '@/components/home/LocationSection';
import { HostSection } from '@/components/home/HostSection';
import styles from './page.module.css';

async function fetchPricingConfig(): Promise<PricingConfig> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('pricing_config').select('key, value');
    const map = Object.fromEntries(
      (data ?? []).map((r: { key: string; value: string }) => [r.key, parseFloat(r.value)])
    );
    return {
      ...DEFAULT_CONFIG,
      pricePerNight: map.price_per_night ?? DEFAULT_CONFIG.pricePerNight,
      cleaningFee: map.cleaning_fee ?? DEFAULT_CONFIG.cleaningFee,
      servicePct: (map.service_fee_pct ?? 14) / 100,
      taxRate: map.tax_rate ?? DEFAULT_CONFIG.taxRate,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function fetchBlockedDates(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('blocked_dates')
      .select('date')
      .gte('date', today);
    return (data ?? []).map((r: { date: string }) => r.date);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [pricingConfig, blockedDates] = await Promise.all([
    fetchPricingConfig(),
    fetchBlockedDates(),
  ]);

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <div className={styles.mainGrid} id="content">
          <div className={styles.sections}>
            <PropertySection />
            <AmenitiesSection />
            <ReviewsSection />
            <LocationSection />
            <HostSection />
          </div>
          <aside className={styles.bookingAside}>
            <BookingWidget
              pricingConfig={pricingConfig}
              blockedDates={blockedDates}
            />
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Write page.module.css**

Create `client/app/page.module.css`:
```css
.mainGrid {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--gutter-mobile);
}
@media (min-width: 768px) {
  .mainGrid { padding: 0 var(--gutter-desktop); }
}
@media (min-width: 1024px) {
  .mainGrid {
    flex-direction: row;
    align-items: flex-start;
    gap: 64px;
  }
  .sections { flex: 1.4; }
  .bookingAside {
    flex: 1;
    padding-top: 64px; /* align with first section */
  }
}

/* Mobile: booking widget pinned at bottom */
@media (max-width: 1023px) {
  .bookingAside {
    order: -1;    /* show booking widget above content on mobile */
    padding: 24px 0;
    border-bottom: 1px solid var(--black);
    margin-bottom: 0;
  }
}
```

- [ ] **Step 3: Delete default Next.js scaffold content**

The `create-next-app` scaffold creates a default `app/page.module.css` with class names like `.main`, `.grid`, `.card`. These conflict with our custom file. Since we wrote our own `page.module.css` in Step 2, the scaffold version was already overwritten — nothing to delete. Just confirm the file contains the `.mainGrid` styles from Step 2 and nothing else.

```bash
grep "mainGrid" app/page.module.css
```
Expected output: `  flex-direction: column;` (inside `.mainGrid` rule). If you see `.main {` instead, you're looking at the scaffold version — re-run Step 2.

- [ ] **Step 4: Start dev server and verify**

```bash
npm run dev -- --port 3001
```

Open http://localhost:3001 and verify:
- [ ] Hero video plays automatically (or poster image shows as fallback)
- [ ] Nav is transparent on top of hero, turns white on scroll
- [ ] PropertySection shows surf cabin copy (not "luxury")
- [ ] BookingWidget shows correct price ($185/night)
- [ ] Selecting dates updates the pricing breakdown with correct totals
- [ ] "Reservar" button calls `/api/checkout` and redirects to Stripe

- [ ] **Step 5: Run unit tests**

```bash
npm test
```
Expected: All pricing tests pass.

- [ ] **Step 6: Final commit**

```bash
git add app/page.tsx app/page.module.css
git commit -m "feat: main page Server Component — parallel Supabase fetches, BookingWidget + all sections wired"
```

---

## Task 16: Encoding Fix Verification

**Files:**
- Verify: all `.tsx` files

- [ ] **Step 1: Search for corrupted characters**

```bash
grep -rn "â€\|Ã\|â€"\|â€™" app/ components/ lib/ store/ types/
```
Expected: **No output.** All files created in this plan use clean TypeScript string literals — no copy-paste from legacy HTML with broken encoding.

- [ ] **Step 2: Verify UTF-8 meta in layout**

`app/layout.tsx` has `<meta charSet="utf-8" />` and `<html lang="es">` — confirmed in Task 7.

- [ ] **Step 3: Final commit tag**

```bash
git add .
git commit -m "feat: Phase 1 complete — Next.js 14, Supabase, Stripe, Hero video, pricing fix, UTF-8 clean"
git tag v2.0.0-phase1
```

---

## Quick Reference: Running the Project

```bash
cd client
npm run dev -- --port 3001   # dev server
npm test                      # unit tests (pricing.ts)
npm run build                 # production build check
```

**Supabase:** Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` from your Supabase project Settings → API.

**Video:** Place `hero-surf.mp4` in `public/video/`. Run `ffmpeg -i public/video/hero-surf.mp4 -vframes 1 public/video/hero-poster.jpg` to generate the poster frame.

**Stripe test card:** `4242 4242 4242 4242` — any future date, any CVV.
