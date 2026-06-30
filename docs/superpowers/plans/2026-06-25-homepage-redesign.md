# BoxRetreat Homepage Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `www/index.html` as a dark, mobile-first, single-property vacation rental page with 9 scroll sections, the approved color palette, Bootstrap Icons, and the existing booking/Stripe JS wired up.

**Architecture:** Replace the current cinema-style multi-section HTML with a clean vertical scroll layout. All new styles go into `www/css/cinema.css` (full replacement). The existing JS files (rental-booking.js, rental-stripe.js, rental-data.js) are kept and re-wired via the same HTML element IDs they already expect.

**Tech Stack:** HTML5, CSS3 (custom properties), Bootstrap Icons 1.11.3, Josefin Sans (Google Fonts), Flatpickr (dates), existing JS stack (rental-data.js, rental-booking.js, rental-stripe.js, fin-store.js)

---

## Color Variables (use these throughout every task)

```css
--br-darkest: #110D0D;   /* nav, section bg, button bg */
--br-dark:    #313030;   /* card bg, secondary bg */
--br-mid:     #686666;   /* borders, muted icons */
--br-light:   #979393;   /* secondary text */
--br-lightest:#C8C3C3;   /* primary text on dark, accents */
--br-white:   #F5F4F4;   /* headings, CTA buttons */
```

## Element IDs required by rental-booking.js (DO NOT RENAME)

```
gallery-wrap          bw-checkin            bw-checkout
bw-date-checkin       bw-date-checkout      bw-guest-num
bw-guest-display      bw-guests-minus       bw-guests-plus
bw-price-display      btn-reserve           booking-widget
booking-overlay       bm-close              bm-title
bm-ci-display         bm-co-display         bm-nights-display
bm-guests-display     bm-pb-nights-label    bm-pb-nights-val
bm-pb-clean-val       bm-pb-svc-val         bm-pb-taxes-val
bm-pb-total-val       bm-change-dates       conf-checkin
conf-checkout         conf-nights           conf-guests
conf-total            conf-booking-id       conf-name
conf-email            availability-calendar
```

## Files

| Action | Path | Purpose |
|---|---|---|
| Full replace | `www/index.html` | New page structure |
| Full replace | `www/css/cinema.css` | New design system (dark palette, all components) |
| No change | `www/js/rental-booking.js` | Existing booking engine |
| No change | `www/js/rental-stripe.js` | Existing Stripe integration |
| No change | `www/js/rental-data.js` | Property data + store |
| No change | `www/js/fin-store.js` | Role guard |

---

## Task 1: Replace cinema.css with new design tokens and base styles

**Files:**
- Replace: `www/css/cinema.css`

- [ ] **Step 1: Write the new cinema.css** — replace the entire file with:

```css
/* BoxRetreat — Design System v2
   Mobile-first · Dark palette · Bootstrap Icons */

:root {
    --br-darkest: #110D0D;
    --br-dark:    #313030;
    --br-mid:     #686666;
    --br-light:   #979393;
    --br-lightest:#C8C3C3;
    --br-white:   #F5F4F4;
    --font-main:  'Josefin Sans', 'Century Gothic', sans-serif;
    --nav-h:      56px;
    --max-w:      680px;
    --radius-sm:  6px;
    --radius-md:  10px;
    --radius-lg:  14px;
}

/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
    background: var(--br-darkest);
    color: var(--br-lightest);
    font-family: var(--font-main);
    font-size: 16px;
    font-weight: 300;
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
}

/* ── Layout wrapper ── */
.br-page {
    max-width: var(--max-w);
    margin: 0 auto;
    width: 100%;
}

/* ── NAV ── */
.br-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 900;
    height: var(--nav-h);
    background: var(--br-darkest);
    border-bottom: 0.5px solid var(--br-dark);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
}
.br-nav-logo {
    font-size: 16px;
    font-weight: 600;
    color: var(--br-white);
    letter-spacing: .02em;
    text-decoration: none;
}
.br-nav-logo span { color: var(--br-light); font-weight: 300; }
.br-nav-links {
    display: flex;
    align-items: center;
    gap: 20px;
}
.br-nav-link {
    font-size: 12px;
    color: var(--br-light);
    text-decoration: none;
    display: none;
}
@media (min-width: 480px) { .br-nav-link { display: block; } }
.br-nav-book {
    background: var(--br-white);
    color: var(--br-darkest);
    font-family: var(--font-main);
    font-size: 12px;
    font-weight: 600;
    padding: 7px 16px;
    border-radius: var(--radius-sm);
    border: none;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
}
.br-nav-book:hover { background: var(--br-lightest); }

/* ── HERO ── */
.br-hero {
    position: relative;
    height: 100svh;
    min-height: 480px;
    max-height: 720px;
    background: var(--br-dark);
    overflow: hidden;
    display: flex;
    align-items: flex-end;
    margin-top: var(--nav-h);
}
.br-hero-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
}
.br-hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(17,13,13,.15) 0%, rgba(17,13,13,.75) 100%);
}
.br-hero-content {
    position: relative;
    z-index: 1;
    padding: 0 24px 28px;
    width: 100%;
}
.br-hero-eyebrow {
    font-size: 10px;
    color: var(--br-lightest);
    letter-spacing: .12em;
    text-transform: uppercase;
    margin-bottom: 8px;
    opacity: .8;
    display: flex;
    align-items: center;
    gap: 5px;
}
.br-hero-title {
    font-size: clamp(2rem, 9vw, 3.5rem);
    font-weight: 600;
    color: var(--br-white);
    line-height: 1.1;
    letter-spacing: -.01em;
}

/* ── RATING BAR ── */
.br-rating-bar {
    background: var(--br-darkest);
    border-bottom: 0.5px solid var(--br-dark);
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.br-stars { color: var(--br-lightest); font-size: 12px; letter-spacing: 2px; }
.br-rating-num { font-size: 13px; font-weight: 600; color: var(--br-white); }
.br-rating-dot { color: var(--br-mid); }
.br-rating-count { font-size: 11px; color: var(--br-light); }

/* ── SECTIONS (shared) ── */
.br-section {
    background: var(--br-darkest);
    padding: 36px 20px;
    border-bottom: 0.5px solid var(--br-dark);
}
.br-section--alt { background: var(--br-dark); }
.br-eyebrow {
    font-size: 9px;
    font-weight: 600;
    color: var(--br-mid);
    letter-spacing: .14em;
    text-transform: uppercase;
    margin-bottom: 8px;
}
.br-section-title {
    font-size: clamp(1.25rem, 4vw, 1.6rem);
    font-weight: 500;
    color: var(--br-white);
    line-height: 1.3;
    margin-bottom: 14px;
}
.br-section-body {
    font-size: 13px;
    color: var(--br-light);
    line-height: 1.8;
}

/* ── ECO BADGE ── */
.br-eco-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0.5px solid var(--br-mid);
    border-radius: 20px;
    padding: 5px 12px;
    margin-bottom: 16px;
    font-size: 10px;
    color: var(--br-lightest);
}
.br-eco-badge i { font-size: 12px; }

/* ── EXPLORE — activity list ── */
.br-act-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
}
.br-act-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: var(--br-dark);
    border-radius: var(--radius-md);
}
.br-act-ico {
    width: 38px;
    height: 38px;
    min-width: 38px;
    background: var(--br-darkest);
    border: 0.5px solid var(--br-mid);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.br-act-ico i { font-size: 16px; color: var(--br-lightest); }
.br-act-name { font-size: 12px; font-weight: 600; color: var(--br-white); margin-bottom: 3px; }
.br-act-desc { font-size: 11px; color: var(--br-light); line-height: 1.5; }

/* ── AMENITIES ── */
.br-am-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 16px;
}
.br-am-item {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 12px;
    border: 0.5px solid var(--br-mid);
    border-radius: var(--radius-sm);
    background: var(--br-darkest);
}
.br-am-item i { font-size: 15px; color: var(--br-lightest); flex-shrink: 0; }
.br-am-item span { font-size: 11px; color: var(--br-light); line-height: 1.3; }

/* ── GEAR RENTAL ── */
.br-gear-list {
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin-top: 16px;
}
.br-gear-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border: 0.5px solid var(--br-dark);
    border-radius: var(--radius-md);
    background: var(--br-dark);
}
.br-gear-ico {
    width: 38px;
    height: 38px;
    min-width: 38px;
    background: var(--br-darkest);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.br-gear-ico i { font-size: 17px; color: var(--br-lightest); }
.br-gear-ico svg { width: 22px; height: 22px; stroke: var(--br-lightest); }
.br-gear-name { font-size: 12px; font-weight: 600; color: var(--br-white); }
.br-gear-price { font-size: 11px; color: var(--br-light); margin-top: 2px; }
.br-gear-btn {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
    border: 0.5px solid var(--br-mid);
    border-radius: var(--radius-sm);
    padding: 6px 12px;
    background: none;
    color: var(--br-lightest);
    cursor: pointer;
    font-family: var(--font-main);
    white-space: nowrap;
    transition: background .15s, border-color .15s;
}
.br-gear-btn:hover {
    background: var(--br-mid);
    border-color: var(--br-lightest);
    color: var(--br-white);
}

/* ── REVIEWS ── */
.br-rev-score {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 18px;
}
.br-rev-big { font-size: 36px; font-weight: 600; color: var(--br-white); }
.br-rev-stars { font-size: 13px; color: var(--br-lightest); letter-spacing: 2px; margin-bottom: 3px; }
.br-rev-count { font-size: 11px; color: var(--br-light); }
.br-rev-card {
    border: 0.5px solid var(--br-mid);
    border-radius: var(--radius-md);
    padding: 14px;
    margin-bottom: 10px;
    background: var(--br-darkest);
}
.br-rev-card-stars { font-size: 10px; color: var(--br-lightest); letter-spacing: 1.5px; margin-bottom: 8px; }
.br-rev-text { font-size: 12px; color: var(--br-light); line-height: 1.7; }
.br-rev-meta { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.br-rev-av {
    width: 26px; height: 26px;
    border-radius: 50%;
    background: var(--br-mid);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 600; color: var(--br-white);
}
.br-rev-author { font-size: 10px; color: var(--br-light); }

/* ── BOOKING WIDGET ── */
.br-book { background: var(--br-darkest); padding: 36px 20px; }
.br-book-price-row {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-bottom: 18px;
}
.br-price-big { font-size: 28px; font-weight: 600; color: var(--br-white); }
.br-price-unit { font-size: 13px; color: var(--br-light); }
.br-date-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
}
.br-date-box {
    border: 0.5px solid var(--br-mid);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    background: var(--br-dark);
    cursor: pointer;
}
.br-date-box:hover { border-color: var(--br-lightest); }
.br-date-lbl {
    font-size: 9px;
    color: var(--br-light);
    text-transform: uppercase;
    letter-spacing: .07em;
    margin-bottom: 3px;
}
.br-date-val { font-size: 13px; font-weight: 600; color: var(--br-white); }
.br-date-val.placeholder { color: var(--br-mid); font-weight: 300; }
.br-guests-row {
    border: 0.5px solid var(--br-mid);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    background: var(--br-dark);
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
}
.br-guests-label { font-size: 9px; color: var(--br-light); text-transform: uppercase; letter-spacing: .07em; }
.br-guests-ctrl { display: flex; align-items: center; gap: 12px; }
.br-guests-btn {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 0.5px solid var(--br-mid);
    background: none;
    color: var(--br-lightest);
    font-size: 16px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-main);
    transition: border-color .15s;
}
.br-guests-btn:disabled { opacity: .3; cursor: default; }
.br-guests-btn:not(:disabled):hover { border-color: var(--br-lightest); }
#bw-guest-num { font-size: 14px; font-weight: 600; color: var(--br-white); min-width: 16px; text-align: center; }
.br-btn-reserve {
    width: 100%;
    background: var(--br-white);
    color: var(--br-darkest);
    border: none;
    border-radius: var(--radius-sm);
    padding: 14px;
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-main);
    cursor: pointer;
    letter-spacing: .02em;
    transition: background .15s;
}
.br-btn-reserve:hover { background: var(--br-lightest); }
.br-fee-rows { margin-top: 14px; display: flex; flex-direction: column; gap: 7px; }
.br-fee-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--br-light); }
.br-fee-row.total {
    font-size: 13px;
    font-weight: 600;
    color: var(--br-white);
    border-top: 0.5px solid var(--br-dark);
    padding-top: 10px;
    margin-top: 5px;
}
.br-price-note { font-size: 11px; color: var(--br-mid); margin-top: 10px; text-align: center; }

/* ── FOOTER ── */
.br-footer {
    background: var(--br-darkest);
    border-top: 0.5px solid var(--br-dark);
    padding: 28px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}
.br-footer-social { display: flex; gap: 20px; }
.br-footer-social a { color: var(--br-mid); font-size: 20px; text-decoration: none; transition: color .15s; }
.br-footer-social a:hover { color: var(--br-lightest); }
.br-footer-made { font-size: 11px; color: var(--br-mid); letter-spacing: .04em; }
.br-footer-admin {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--br-light);
    border: 0.5px solid var(--br-dark);
    border-radius: var(--radius-sm);
    padding: 7px 14px;
    background: none;
    cursor: pointer;
    font-family: var(--font-main);
    text-decoration: none;
    transition: border-color .15s, color .15s;
}
.br-footer-admin:hover { border-color: var(--br-mid); color: var(--br-lightest); }
.br-footer-admin i { font-size: 12px; }

/* ── BOOKING MODAL (kept from rental-booking.js) ── */
#booking-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(17,13,13,.85);
    z-index: 1000;
    align-items: center;
    justify-content: center;
    padding: 20px;
}
#booking-overlay.open { display: flex; }
.booking-modal {
    background: var(--br-dark);
    border: 0.5px solid var(--br-mid);
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 460px;
    max-height: 90vh;
    overflow-y: auto;
}
.admin-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 20px;
    border-bottom: 0.5px solid var(--br-mid);
}
.admin-modal-header h3 { font-size: 15px; font-weight: 600; color: var(--br-white); }
.admin-modal-body { padding: 20px; }
.admin-modal-footer { padding: 16px 20px; border-top: 0.5px solid var(--br-mid); }
#bm-close {
    background: none;
    border: none;
    color: var(--br-light);
    font-size: 18px;
    cursor: pointer;
}

/* ── TOAST ── */
.br-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--br-dark);
    border: 0.5px solid var(--br-mid);
    border-radius: var(--radius-sm);
    padding: 10px 20px;
    font-size: 13px;
    color: var(--br-lightest);
    z-index: 2000;
    white-space: nowrap;
    opacity: 0;
    transition: opacity .2s;
}
.br-toast.visible { opacity: 1; }

/* ── AVAILABILITY CALENDAR (flatpickr override) ── */
.flatpickr-calendar {
    background: var(--br-dark) !important;
    border: 0.5px solid var(--br-mid) !important;
    border-radius: var(--radius-md) !important;
    box-shadow: none !important;
    font-family: var(--font-main) !important;
}
.flatpickr-day { color: var(--br-lightest) !important; border-radius: 50% !important; }
.flatpickr-day:hover { background: var(--br-mid) !important; }
.flatpickr-day.selected { background: var(--br-white) !important; color: var(--br-darkest) !important; }
.flatpickr-day.disabled, .flatpickr-day.flatpickr-disabled { color: var(--br-mid) !important; opacity: .4; }
.flatpickr-months, .flatpickr-weekdays { background: var(--br-dark) !important; }
.flatpickr-current-month, .flatpickr-weekday { color: var(--br-light) !important; }
.flatpickr-prev-month svg, .flatpickr-next-month svg { fill: var(--br-light) !important; }

/* ── LOADING STATE ── */
body.is-loading { opacity: 0; }
body { transition: opacity .3s ease; }
```

- [ ] **Step 2: Verify the file saved correctly**

```bash
head -5 www/css/cinema.css
```
Expected output: `/* BoxRetreat — Design System v2`

- [ ] **Step 3: Commit**

```bash
git add www/css/cinema.css
git commit -m "feat: replace cinema.css with dark palette design system"
```

---

## Task 2: Rebuild index.html — `<head>` and Nav

**Files:**
- Replace: `www/index.html` (start fresh, build incrementally)

- [ ] **Step 1: Write the new index.html head + nav**

Replace the entire file with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <title>BoxRetreat — Surf Cabin · Luquillo, Puerto Rico</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="A solar-powered container cabin steps from Luquillo Beach, Puerto Rico. Surf, explore El Yunque, and disconnect. Book direct — no platform fees." />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://www.boxretreat.com/" />

    <!-- Open Graph -->
    <meta property="og:type"        content="website" />
    <meta property="og:title"       content="BoxRetreat — Surf Cabin · Luquillo, Puerto Rico" />
    <meta property="og:description" content="Steps from the surf. Minutes from El Yunque. Solar-powered container cabin with BBQ deck. Book direct." />
    <meta property="og:image"       content="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=630&fit=crop&q=90" />
    <meta property="og:url"         content="https://www.boxretreat.com/" />
    <meta name="twitter:card"       content="summary_large_image" />

    <link rel="icon" type="image/ico" href="favicon.ico" />

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;600&display=swap" />

    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />

    <!-- Flatpickr -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css" />

    <!-- Styles -->
    <link rel="stylesheet" href="css/cinema.css" />
</head>

<body class="is-loading">

<!-- NAV -->
<nav class="br-nav" role="navigation" aria-label="Main navigation">
    <a href="/" class="br-nav-logo" aria-label="BoxRetreat home">Box<span>Retreat</span></a>
    <div class="br-nav-links">
        <a href="#explore"   class="br-nav-link">Explore</a>
        <a href="#amenities" class="br-nav-link">Amenities</a>
        <a href="#gear"      class="br-nav-link">Gear</a>
        <a href="#book"      class="br-nav-book">Book now</a>
    </div>
</nav>

<!-- PAGE CONTENT placeholder — next tasks add sections here -->
<main class="br-page" id="br-main">
</main>

</body>
</html>
```

- [ ] **Step 2: Open browser and verify nav renders correctly**

Open http://localhost:3000 — you should see a dark page with the BoxRetreat nav bar.

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: new index.html shell with nav"
```

---

## Task 3: Hero section + Rating bar

**Files:**
- Modify: `www/index.html` — add hero + rating bar inside `<main>`

- [ ] **Step 1: Replace the empty `<main>` with hero + rating bar**

Replace `<main class="br-page" id="br-main">\n</main>` with:

```html
<main class="br-page" id="br-main">

<!-- ── HERO ── -->
<section class="br-hero" id="hero" aria-label="BoxRetreat hero">
    <img
        class="br-hero-img"
        src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=85&auto=format"
        alt="BoxRetreat surf cabin exterior at Luquillo, Puerto Rico"
        loading="eager"
        fetchpriority="high"
    />
    <div class="br-hero-overlay" aria-hidden="true"></div>
    <div class="br-hero-content">
        <p class="br-hero-eyebrow"><i class="bi bi-geo-alt" aria-hidden="true"></i> Luquillo · Puerto Rico</p>
        <h1 class="br-hero-title">BoxRetreat<br>Surf Cabin</h1>
    </div>
</section>

<!-- ── RATING BAR ── -->
<div class="br-rating-bar" aria-label="Guest rating">
    <span class="br-stars" aria-label="5 stars">★★★★★</span>
    <span class="br-rating-num">4.97</span>
    <span class="br-rating-dot" aria-hidden="true">·</span>
    <span class="br-rating-count">83 verified guest reviews</span>
</div>

</main>
```

- [ ] **Step 2: Verify in browser** — hero image fills viewport, title visible, rating bar below.

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: hero section and rating bar"
```

---

## Task 4: Our Story section

**Files:**
- Modify: `www/index.html` — add story section after rating bar, before `</main>`

- [ ] **Step 1: Add story section inside `<main>` after the rating bar div**

```html
<!-- ── OUR STORY ── -->
<section class="br-section" id="story" aria-label="Our story">
    <p class="br-eyebrow">Our story</p>
    <span class="br-eco-badge">
        <i class="bi bi-sun-fill" aria-hidden="true"></i>
        Solar powered · eco-friendly property
    </span>
    <h2 class="br-section-title">Built with our hands.<br>Made for your adventure.</h2>
    <p class="br-section-body">
        BoxRetreat started as a personal project — a dream to build something real, something that lets
        people experience Puerto Rico the way we love it. We converted a shipping container into a surf
        cabin that feels raw, honest, and close to everything that makes Luquillo special. Powered by
        the sun, built to respect the land, and designed for the kind of traveler who wants to be
        outside more than inside. No corporate feel. No unnecessary extras. Just the ocean, the
        rainforest, and a place to come back to after a long day in the water.
    </p>
</section>
```

- [ ] **Step 2: Verify in browser** — dark section with eco badge and story text visible.

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: our story section with eco badge"
```

---

## Task 5: Explore the Area section

**Files:**
- Modify: `www/index.html` — add explore section after story

- [ ] **Step 1: Add explore section**

```html
<!-- ── EXPLORE ── -->
<section class="br-section br-section--alt" id="explore" aria-label="Explore the area">
    <p class="br-eyebrow">Explore the area</p>
    <h2 class="br-section-title">Everything you need is right outside.</h2>
    <ul class="br-act-list" role="list">
        <li class="br-act-item">
            <div class="br-act-ico" aria-hidden="true"><i class="bi bi-water"></i></div>
            <div>
                <p class="br-act-name">Luquillo Beach</p>
                <p class="br-act-desc">2 min walk · calm waters, surf breaks, food kiosks along the shore</p>
            </div>
        </li>
        <li class="br-act-item">
            <div class="br-act-ico" aria-hidden="true"><i class="bi bi-tree-fill"></i></div>
            <div>
                <p class="br-act-name">El Yunque Rainforest</p>
                <p class="br-act-desc">15 min drive · hiking trails, waterfalls, and incredible wildlife</p>
            </div>
        </li>
        <li class="br-act-item">
            <div class="br-act-ico" aria-hidden="true"><i class="bi bi-wind"></i></div>
            <div>
                <p class="br-act-name">Surf spots</p>
                <p class="br-act-desc">La Pared, El Toro — beginner to advanced breaks just minutes away</p>
            </div>
        </li>
        <li class="br-act-item">
            <div class="br-act-ico" aria-hidden="true"><i class="bi bi-cup-hot-fill"></i></div>
            <div>
                <p class="br-act-name">Local food &amp; culture</p>
                <p class="br-act-desc">5 min walk · kiosks, cocina criolla, fresh seafood and local markets</p>
            </div>
        </li>
        <li class="br-act-item">
            <div class="br-act-ico" aria-hidden="true"><i class="bi bi-building"></i></div>
            <div>
                <p class="br-act-name">Old San Juan</p>
                <p class="br-act-desc">45 min drive · colorful streets, history, art galleries and nightlife</p>
            </div>
        </li>
    </ul>
</section>
```

- [ ] **Step 2: Verify in browser** — dark-alt section with 5 activity cards.

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: explore the area section"
```

---

## Task 6: Amenities section

**Files:**
- Modify: `www/index.html` — add amenities after explore

- [ ] **Step 1: Add amenities section**

```html
<!-- ── AMENITIES ── -->
<section class="br-section" id="amenities" aria-label="Amenities">
    <p class="br-eyebrow">Amenities</p>
    <h2 class="br-section-title">Everything you need, nothing you don't.</h2>
    <span class="br-eco-badge">
        <i class="bi bi-sun-fill" aria-hidden="true"></i>
        Solar powered · eco-friendly
    </span>
    <ul class="br-am-grid" role="list">
        <li class="br-am-item"><i class="bi bi-wind" aria-hidden="true"></i><span>Air conditioning</span></li>
        <li class="br-am-item"><i class="bi bi-wifi" aria-hidden="true"></i><span>High-speed Wi-Fi</span></li>
        <li class="br-am-item"><i class="bi bi-fire" aria-hidden="true"></i><span>BBQ deck</span></li>
        <li class="br-am-item"><i class="bi bi-egg-fried" aria-hidden="true"></i><span>Full kitchen</span></li>
        <li class="br-am-item"><i class="bi bi-droplet-fill" aria-hidden="true"></i><span>Outdoor shower</span></li>
        <li class="br-am-item"><i class="bi bi-p-square-fill" aria-hidden="true"></i><span>Parking</span></li>
        <li class="br-am-item"><i class="bi bi-door-open-fill" aria-hidden="true"></i><span>Self check-in</span></li>
        <li class="br-am-item"><i class="bi bi-moon-stars-fill" aria-hidden="true"></i><span>Private deck</span></li>
    </ul>
</section>
```

- [ ] **Step 2: Verify** — 2-column icon grid, 8 items.

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: amenities section"
```

---

## Task 7: Gear Rental section

**Files:**
- Modify: `www/index.html` — add gear section after amenities

The Snorkel and Kayak icons use inline SVG. All others use Bootstrap Icons.

- [ ] **Step 1: Add gear section**

```html
<!-- ── GEAR RENTAL ── -->
<section class="br-section br-section--alt" id="gear" aria-label="Gear rental">
    <p class="br-eyebrow">Gear rental</p>
    <h2 class="br-section-title">Gear up. We bring it to the cabin.</h2>
    <ul class="br-gear-list" role="list">

        <li class="br-gear-item">
            <div class="br-gear-ico" aria-hidden="true"><i class="bi bi-tsunami"></i></div>
            <div><p class="br-gear-name">Surfboard</p><p class="br-gear-price">$35 / day</p></div>
            <a href="shop.html" class="br-gear-btn">Add to stay</a>
        </li>

        <li class="br-gear-item">
            <div class="br-gear-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <ellipse cx="12" cy="11" rx="7" ry="4.5"/>
                    <path d="M5 11c0 0-2 .8-2 2.5S5 16 5 16h14s2-.8 2-2.5S19 11 19 11"/>
                    <line x1="15.5" y1="6.5" x2="15.5" y2="3"/>
                    <path d="M15.5 3 Q15.5 1.5 17 1.5 Q18.5 1.5 18.5 3 L18.5 7"/>
                </svg>
            </div>
            <div><p class="br-gear-name">Snorkel set</p><p class="br-gear-price">$15 / day</p></div>
            <a href="shop.html" class="br-gear-btn">Add to stay</a>
        </li>

        <li class="br-gear-item">
            <div class="br-gear-ico" aria-hidden="true">
                <svg viewBox="-3 -3 30 30" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="7" y1="7" x2="17" y2="17"/>
                    <ellipse cx="3.5" cy="3.5" rx="4.5" ry="2" transform="rotate(45 3.5 3.5)"/>
                    <ellipse cx="20.5" cy="20.5" rx="4.5" ry="2" transform="rotate(45 20.5 20.5)"/>
                    <line x1="17" y1="7" x2="7" y2="17"/>
                    <ellipse cx="20.5" cy="3.5" rx="4.5" ry="2" transform="rotate(-45 20.5 3.5)"/>
                    <ellipse cx="3.5" cy="20.5" rx="4.5" ry="2" transform="rotate(-45 3.5 20.5)"/>
                </svg>
            </div>
            <div><p class="br-gear-name">Kayak</p><p class="br-gear-price">$45 / day</p></div>
            <a href="shop.html" class="br-gear-btn">Add to stay</a>
        </li>

        <li class="br-gear-item">
            <div class="br-gear-ico" aria-hidden="true"><i class="bi bi-camera-fill"></i></div>
            <div><p class="br-gear-name">GoPro</p><p class="br-gear-price">$25 / day</p></div>
            <a href="shop.html" class="br-gear-btn">Add to stay</a>
        </li>

        <li class="br-gear-item">
            <div class="br-gear-ico" aria-hidden="true"><i class="bi bi-bicycle"></i></div>
            <div><p class="br-gear-name">Bike</p><p class="br-gear-price">$20 / day</p></div>
            <a href="shop.html" class="br-gear-btn">Add to stay</a>
        </li>

        <li class="br-gear-item">
            <div class="br-gear-ico" aria-hidden="true"><i class="bi bi-umbrella-fill"></i></div>
            <div><p class="br-gear-name">Beach set</p><p class="br-gear-price">$18 / day</p></div>
            <a href="shop.html" class="br-gear-btn">Add to stay</a>
        </li>

    </ul>
</section>
```

- [ ] **Step 2: Verify** — 6 gear items, snorkel/kayak icons render correctly.

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: gear rental section with custom SVG icons"
```

---

## Task 8: Reviews section

**Files:**
- Modify: `www/index.html` — add reviews after gear

- [ ] **Step 1: Add reviews section**

```html
<!-- ── REVIEWS ── -->
<section class="br-section" id="reviews" aria-label="Guest reviews">
    <p class="br-eyebrow">Reviews</p>
    <h2 class="br-section-title">From guests who stayed here.</h2>

    <div class="br-rev-score">
        <span class="br-rev-big">4.97</span>
        <div>
            <p class="br-rev-stars" aria-label="5 stars">★★★★★</p>
            <p class="br-rev-count">83 verified guest reviews</p>
        </div>
    </div>

    <article class="br-rev-card">
        <p class="br-rev-card-stars" aria-label="5 stars">★★★★★</p>
        <p class="br-rev-text">"Woke up to the sound of waves every morning. The cabin is exactly what it looks like — raw, real, and perfectly located. Surfed La Pared every day, then came back and grilled on the deck. Perfect week."</p>
        <div class="br-rev-meta">
            <div class="br-rev-av" aria-hidden="true">ST</div>
            <span class="br-rev-author">Sarah T. · stayed June 2025 · 5 nights</span>
        </div>
    </article>

    <article class="br-rev-card">
        <p class="br-rev-card-stars" aria-label="5 stars">★★★★★</p>
        <p class="br-rev-text">"We rented the surfboards and the snorkel gear — worth every dollar. The team made everything seamless. Luquillo is incredible and BoxRetreat is the best base for it."</p>
        <div class="br-rev-meta">
            <div class="br-rev-av" aria-hidden="true">JR</div>
            <span class="br-rev-author">James R. · stayed March 2025 · 3 nights</span>
        </div>
    </article>

    <article class="br-rev-card">
        <p class="br-rev-card-stars" aria-label="5 stars">★★★★★</p>
        <p class="br-rev-text">"Solo trip. Best decision I made. Quiet enough to decompress, wild enough to feel alive. The outdoor shower after a surf session is a vibe. I'll be back."</p>
        <div class="br-rev-meta">
            <div class="br-rev-av" aria-hidden="true">MK</div>
            <span class="br-rev-author">Marcus K. · stayed January 2025 · 4 nights</span>
        </div>
    </article>
</section>
```

- [ ] **Step 2: Verify** — 3 review cards with score, stars and author metadata.

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: reviews section"
```

---

## Task 9: Booking Widget + Booking Modal

**Files:**
- Modify: `www/index.html` — add booking widget + modal after reviews

This task wires the HTML element IDs that `rental-booking.js` already expects.

- [ ] **Step 1: Add booking widget section**

```html
<!-- ── BOOKING WIDGET ── -->
<section class="br-book br-section--alt" id="book" aria-label="Book your stay">
    <div class="br-book-price-row">
        <span class="br-price-big" id="bw-price-display">$185</span>
        <span class="br-price-unit">/ night</span>
    </div>

    <div class="br-date-grid">
        <div class="br-date-box" id="bw-date-checkin" role="button" tabindex="0" aria-label="Select check-in date">
            <p class="br-date-lbl">Check-in</p>
            <p class="br-date-val placeholder" id="bw-checkin">Add date</p>
        </div>
        <div class="br-date-box" id="bw-date-checkout" role="button" tabindex="0" aria-label="Select check-out date">
            <p class="br-date-lbl">Check-out</p>
            <p class="br-date-val placeholder" id="bw-checkout">Add date</p>
        </div>
    </div>

    <div class="br-guests-row">
        <p class="br-guests-label">Guests</p>
        <div class="br-guests-ctrl">
            <button class="br-guests-btn" id="bw-guests-minus" aria-label="Remove guest" disabled>−</button>
            <span id="bw-guest-num">2</span>
            <button class="br-guests-btn" id="bw-guests-plus" aria-label="Add guest">+</button>
        </div>
    </div>
    <p style="font-size:11px;color:var(--br-mid);margin-bottom:14px;" id="bw-guest-display">2 guests</p>

    <button class="br-btn-reserve" id="btn-reserve">Reserve</button>

    <div class="br-fee-rows" id="booking-widget" style="display:none;">
        <div class="br-fee-row"><span id="bm-pb-nights-label">Nights</span><span id="bm-pb-nights-val">—</span></div>
        <div class="br-fee-row"><span>Cleaning fee</span><span id="bm-pb-clean-val">—</span></div>
        <div class="br-fee-row"><span>Service fee (14%)</span><span id="bm-pb-svc-val">—</span></div>
        <div class="br-fee-row"><span>Taxes (11.5%)</span><span id="bm-pb-taxes-val">—</span></div>
        <div class="br-fee-row total"><span>Total</span><span id="bm-pb-total-val">—</span></div>
    </div>

    <p class="br-price-note">You won't be charged yet</p>
</section>

<!-- ── BOOKING MODAL ── -->
<div id="booking-overlay" role="dialog" aria-modal="true" aria-label="Booking details">
    <div class="booking-modal">
        <div class="admin-modal-header">
            <h3 id="bm-title">Confirm your stay</h3>
            <button id="bm-close" aria-label="Close">&times;</button>
        </div>
        <div class="admin-modal-body">
            <p style="font-size:13px;color:var(--br-light);margin-bottom:16px;">
                <strong style="color:var(--br-white);" id="bm-ci-display">—</strong>
                &rarr;
                <strong style="color:var(--br-white);" id="bm-co-display">—</strong>
                &nbsp;·&nbsp; <span id="bm-nights-display">—</span> nights
                &nbsp;·&nbsp; <span id="bm-guests-display">—</span>
            </p>
            <div class="br-fee-rows" style="margin-bottom:16px;">
                <div class="br-fee-row"><span id="bm-pb-nights-label-modal">Nights</span><span id="bm-pb-nights-val-modal">—</span></div>
                <div class="br-fee-row"><span>Cleaning fee</span><span id="bm-pb-clean-val-modal">—</span></div>
                <div class="br-fee-row"><span>Service fee</span><span id="bm-pb-svc-val-modal">—</span></div>
                <div class="br-fee-row"><span>Taxes</span><span id="bm-pb-taxes-val-modal">—</span></div>
                <div class="br-fee-row total"><span>Total</span><span id="bm-pb-total-val-modal">—</span></div>
            </div>
            <input type="text"  id="contact-name"  placeholder="Your full name"  style="width:100%;margin-bottom:10px;padding:10px 12px;background:var(--br-dark);border:0.5px solid var(--br-mid);border-radius:6px;color:var(--br-white);font-family:var(--font-main);font-size:13px;" />
            <input type="email" id="contact-email" placeholder="Email address"   style="width:100%;margin-bottom:10px;padding:10px 12px;background:var(--br-dark);border:0.5px solid var(--br-mid);border-radius:6px;color:var(--br-white);font-family:var(--font-main);font-size:13px;" />
            <input type="tel"   id="contact-phone" placeholder="Phone number"    style="width:100%;margin-bottom:10px;padding:10px 12px;background:var(--br-dark);border:0.5px solid var(--br-mid);border-radius:6px;color:var(--br-white);font-family:var(--font-main);font-size:13px;" />
            <textarea id="contact-notes" placeholder="Any questions or special requests?" rows="3" style="width:100%;padding:10px 12px;background:var(--br-dark);border:0.5px solid var(--br-mid);border-radius:6px;color:var(--br-white);font-family:var(--font-main);font-size:13px;resize:vertical;"></textarea>
        </div>
        <div class="admin-modal-footer">
            <button id="btn-save" class="br-btn-reserve" style="margin-bottom:8px;">Proceed to payment</button>
            <button id="bm-change-dates" style="width:100%;background:none;border:0.5px solid var(--br-mid);border-radius:6px;padding:10px;color:var(--br-light);font-family:var(--font-main);font-size:12px;cursor:pointer;">Change dates</button>
        </div>
    </div>
</div>
```

- [ ] **Step 2: Verify in browser** — booking widget shows price, date boxes, guest counter and Reserve button. Clicking Reserve should open the modal (rental-booking.js handles this).

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: booking widget and modal wired to rental-booking.js"
```

---

## Task 10: Footer + Scripts

**Files:**
- Modify: `www/index.html` — add footer + all script tags before `</body>`

- [ ] **Step 1: Close `</main>` and add footer + scripts**

After the booking modal `</div>` and before `</body>`:

```html
<!-- ── FOOTER ── -->
<footer class="br-footer" role="contentinfo">
    <div class="br-footer-social" aria-label="Social media">
        <a href="https://instagram.com" target="_blank" rel="noopener" aria-label="Instagram"><i class="bi bi-instagram"></i></a>
        <a href="https://tiktok.com"    target="_blank" rel="noopener" aria-label="TikTok"><i class="bi bi-tiktok"></i></a>
        <a href="https://facebook.com"  target="_blank" rel="noopener" aria-label="Facebook"><i class="bi bi-facebook"></i></a>
    </div>
    <p class="br-footer-made">Made in Puerto Rico</p>
    <a href="admin.html" class="br-footer-admin">
        <i class="bi bi-lock" aria-hidden="true"></i>
        Administrative Portal
    </a>
</footer>

<!-- ── SCRIPTS ── -->
<script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
<script src="js/rental-data.js"></script>
<script src="js/rental-booking.js"></script>
<script src="js/rental-stripe.js"></script>
<script src="js/fin-store.js"></script>
<script>
    // Remove loading state after page renders
    document.addEventListener('DOMContentLoaded', function () {
        document.body.classList.remove('is-loading');
    });
</script>
```

- [ ] **Step 2: Verify in browser**
  - Footer shows 3 social icons + "Made in Puerto Rico" + "Administrative Portal"
  - Console shows no JS errors
  - Booking date picker opens when clicking date boxes
  - Reserve button opens modal

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "feat: footer and scripts — page complete"
```

---

## Task 11: Fix canonical URLs and internal links

**Files:**
- Modify: `www/index.html`

The old page had `rental.html` references in meta tags and the nav logo.

- [ ] **Step 1: Verify these values are correct in `<head>`**

```html
<link rel="canonical" href="https://www.boxretreat.com/" />
<meta property="og:url" content="https://www.boxretreat.com/" />
```

- [ ] **Step 2: Verify nav logo href**

```html
<a href="/" class="br-nav-logo">
```

- [ ] **Step 3: Commit**

```bash
git add www/index.html
git commit -m "fix: canonical URLs point to boxretreat.com/"
```

---

## Task 12: Deploy to production

- [ ] **Step 1: Push to GitHub**

```bash
git push origin master
```

- [ ] **Step 2: Deploy to Vercel**

```bash
vercel --prod
```

- [ ] **Step 3: Verify live site**

Open https://boxretreat.com — verify:
- Dark page loads, hero image visible
- Nav "Book now" scrolls to booking section
- All 9 sections render correctly
- Booking widget functional
- Footer admin link goes to /admin.html
- No console errors
