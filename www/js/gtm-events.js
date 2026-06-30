/**
 * gtm-events.js — BoxRetreat Conversion Tracking
 *
 * Pushes structured events to window.dataLayer for Google Tag Manager.
 * GTM then forwards these to GA4, Meta Pixel, TikTok Pixel, and Google Ads.
 *
 * Event taxonomy:
 *   cta_click       → button presses (Reserve, WhatsApp, View Availability)
 *   dates_selected  → user chose check-in / check-out
 *   begin_checkout  → Reserve clicked with valid dates
 *   purchase        → Stripe payment confirmed (success.html)
 *   engagement      → soft interactions (show more, save, scroll depth)
 */
(function () {
    'use strict';

    window.dataLayer = window.dataLayer || [];

    function push(event, params) {
        window.dataLayer.push(Object.assign({ event }, params));
    }

    /* ── Bind click event to a DOM element by ID ── */
    function onId(id, eventName, params) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', () => push(eventName, params));
    }

    /* ── Bind click event by CSS selector (first match) ── */
    function onSel(selector, eventName, params) {
        const el = document.querySelector(selector);
        if (!el) return;
        el.addEventListener('click', () => push(eventName, params));
    }

    document.addEventListener('DOMContentLoaded', function () {

        /* ─────────────────────────────────────────
           PRIMARY CTAs (conversion-critical)
        ───────────────────────────────────────── */

        // "Reserve" button in the booking widget sidebar
        onId('btn-reserve', 'cta_click', {
            cta_name:       'reserve_now',
            cta_location:   'booking_widget',
            page:           'rental',
        });

        // "Book Now" / mobile sticky button (if present)
        onId('btn-reserve-mobile', 'cta_click', {
            cta_name:       'reserve_now_mobile',
            cta_location:   'mobile_sticky',
            page:           'rental',
        });

        // WhatsApp direct contact
        onId('btn-whatsapp', 'cta_click', {
            cta_name:       'contact_whatsapp',
            cta_location:   'host_section',
            page:           'rental',
        });

        // "View Availability" inline calendar
        onId('btn-availability', 'cta_click', {
            cta_name:       'view_availability',
            cta_location:   'calendar_section',
            page:           'rental',
        });

        // "Contact Michael" email host button
        onSel('.btn-contact-host', 'cta_click', {
            cta_name:       'contact_host_email',
            cta_location:   'host_section',
            page:           'rental',
        });

        /* ─────────────────────────────────────────
           SOFT ENGAGEMENT EVENTS
        ───────────────────────────────────────── */

        onId('btn-show-more', 'engagement', { action: 'read_more_description' });
        onId('btn-save',      'engagement', { action: 'save_listing' });
        onSel('.btn-show-reviews',   'engagement', { action: 'show_all_reviews' });
        onSel('.btn-show-amenities', 'engagement', { action: 'show_all_amenities' });

        /* ─────────────────────────────────────────
           SHOP CTAs
        ───────────────────────────────────────── */

        // Delegated — shop items added dynamically
        document.addEventListener('click', function (e) {
            const btn = e.target.closest('.shop-add-btn, [data-track="add-to-cart"]');
            if (!btn) return;
            push('cta_click', {
                cta_name:     'add_to_cart',
                cta_location: 'shop_grid',
                item_name:    btn.dataset.name || btn.closest('[data-name]')?.dataset.name || '',
                page:         'shop',
            });
        });

        /* ─────────────────────────────────────────
           BOOKING FUNNEL — custom events fired by
           rental-booking.js via CustomEvent
        ───────────────────────────────────────── */

        // Dates selected in the calendar
        document.addEventListener('br:dates_selected', function (e) {
            push('dates_selected', {
                check_in:  e.detail.checkIn,
                check_out: e.detail.checkOut,
                nights:    e.detail.nights,
            });
        });

        // Reserve button clicked with valid dates → starts checkout flow
        document.addEventListener('br:checkout_start', function (e) {
            push('begin_checkout', {
                value:    e.detail.total,
                currency: 'USD',
                nights:   e.detail.nights,
                guests:   e.detail.guests,
            });
        });

        // Stripe checkout session created (redirect initiated)
        document.addEventListener('br:stripe_redirect', function (e) {
            push('checkout_redirect', {
                session_id: e.detail.sessionId,
                value:      e.detail.total,
                currency:   'USD',
            });
        });

        // Booking confirmed on success.html
        document.addEventListener('br:booking_confirmed', function (e) {
            push('purchase', {
                transaction_id: e.detail.id,
                value:          e.detail.total,
                currency:       'USD',
                nights:         e.detail.nights,
                guests:         e.detail.guests,
                tax:            e.detail.taxes  || 0,
                shipping:       0,
                items: [{
                    item_id:       'BOXRETREAT_RENTAL',
                    item_name:     'BoxRetreat — Luquillo, Puerto Rico',
                    item_category: 'Vacation Rental',
                    quantity:      e.detail.nights,
                    price:         e.detail.pricePerNight || 185,
                }],
            });
        });

        /* ─────────────────────────────────────────
           SCROLL DEPTH (25 / 50 / 75 / 90%)
        ───────────────────────────────────────── */
        const scrollThresholds = [25, 50, 75, 90];
        const fired = new Set();
        window.addEventListener('scroll', function () {
            const pct = Math.round(
                (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
            );
            scrollThresholds.forEach(t => {
                if (pct >= t && !fired.has(t)) {
                    fired.add(t);
                    push('scroll_depth', { depth: t, page: window.location.pathname });
                }
            });
        }, { passive: true });

    });

})();
