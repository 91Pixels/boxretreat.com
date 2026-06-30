# BoxRetreat Homepage Redesign — Design Spec

## Goal
Rebuild `www/index.html` as a clean, mobile-first, single-property vacation rental page that tells the owner's story, showcases the area, amenities, gear rental, and drives direct bookings.

## Color Palette
| Variable | Hex | Role |
|---|---|---|
| `--br-darkest` | `#110D0D` | Nav bg, section bg, button bg |
| `--br-dark` | `#313030` | Card bg, secondary section bg |
| `--br-mid` | `#686666` | Borders, muted icons |
| `--br-light` | `#979393` | Secondary text, descriptions |
| `--br-lightest` | `#C8C3C3` | Primary text on dark, accents |
| `--br-white` | `#F5F4F4` | Headings, CTA buttons, logos |

## Typography
- Font: Josefin Sans (already loaded)
- Headings: 500 weight, `--br-white`
- Body: 400 weight, `--br-light`
- Eyebrows: 9-10px, uppercase, letter-spacing .1em, `--br-mid`

## Page Sections (scroll order)
1. **Nav** — logo left, "Book now" pill right. Fixed top, transparent → solid on scroll.
2. **Hero** — full-width image, dark overlay, property name + location. Rating bar below.
3. **Our Story** — owner message, eco/solar badge, short paragraph.
4. **Explore the Area** — 4 activity cards (icon + name + distance/description).
5. **Amenities** — eco badge + 2-column icon grid (7 items, no Ocean View).
6. **Gear Rental** — 6 items list (Surfboard, Snorkel set, Kayak, GoPro, Bike, Beach set). Custom SVG for Snorkel + Kayak.
7. **Reviews** — 4.97 score + 2 verified guest reviews.
8. **Booking Widget** — price/night, check-in/out date pickers, guests, fee breakdown, Reserve button.
9. **Footer** — social icons (Instagram, TikTok, Facebook), "Made in Puerto Rico", Administrative Portal button.

## Icons
- Bootstrap Icons 1.11.3 via CDN
- Custom SVG for Snorkel (diving mask + tube) and Kayak (crossed paddles with oval blades)
- No emojis anywhere

## Key Constraints
- Single property — no multi-listing UI
- All text in English
- Mobile-first (320px base), desktop max-width 680px centered
- Keep existing JS: rental-booking.js, rental-stripe.js, rental-data.js, fin-store.js
- Footer Admin Portal button links to admin.html
- Booking widget wires to existing Stripe flow

## Files Affected
- `www/index.html` — full rebuild
- `www/css/cinema.css` — replace with new design system styles
- `www/style.css` — add `body.admin-body`-style override for dark bg (already done for admin)
