/**
 * rental-stripe.js — Frontend Stripe Checkout integration
 * Overrides the booking modal "Confirm" button to redirect through Stripe.
 * Depends on: rental-data.js, rental-booking.js (must load before this file)
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        _patchConfirmButton();
        _handleCancelledReturn();
    });

    /* ---- Replace the confirm button's listener with our Stripe handler ---- */
    function _patchConfirmButton() {
        const original = document.getElementById('btn-step3-confirm');
        if (!original) return;

        // Clone removes all existing listeners
        const btn = original.cloneNode(true);
        original.parentNode.replaceChild(btn, original);

        btn.addEventListener('click', _handleCheckout);
    }

    /* ---- Main checkout handler ---- */
    async function _handleCheckout() {
        const state = window.RentalBooking ? window.RentalBooking.getState() : null;
        if (!state || !state.checkIn || !state.checkOut) {
            _toast('Missing booking data — please select dates again.', 'error');
            return;
        }

        const price = RentalUtils.calcPrice(state.checkIn, state.checkOut, RentalStore.getCurrentPrice());
        if (!price) {
            _toast('Could not calculate price. Please try again.', 'error');
            return;
        }

        const guestName    = _val('contact-name');
        const guestEmail   = _val('contact-email');
        const guestPhone   = _val('contact-phone');
        const guestCountry = _val('contact-country');
        const guestNotes   = _val('contact-notes');

        if (!guestName || !guestEmail || !guestPhone) {
            _toast('Please fill in all required contact fields.', 'error');
            return;
        }

        /* --- Save pending reservation (confirmed after payment) --- */
        const pending = {
            id:        RentalUtils.genId(),
            guest: {
                name:    guestName,
                email:   guestEmail,
                phone:   guestPhone,
                country: guestCountry,
                notes:   guestNotes,
            },
            checkIn:   state.checkIn.toISOString().split('T')[0],
            checkOut:  state.checkOut.toISOString().split('T')[0],
            guests:    state.guests,
            price:     price,
            status:    'pending',
            createdAt: new Date().toISOString(),
        };

        try {
            localStorage.setItem('br_pending_reservation', JSON.stringify(pending));
        } catch (_) { /* localStorage full — continue anyway */ }

        /* --- Show loading state --- */
        const btn = document.getElementById('btn-step3-confirm');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Redirecting to checkout…';
        }

        /* --- Call backend to create Stripe session --- */
        try {
            const resp = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checkIn:       pending.checkIn,
                    checkOut:      pending.checkOut,
                    guests:        pending.guests,
                    nights:        price.nights,
                    pricePerNight: price.pricePerNight,
                    cleaning:      price.clean,
                    serviceFee:    price.svc,
                    taxes:         price.taxes,
                    total:         price.total,
                    guestName:     guestName,
                    guestEmail:    guestEmail,
                }),
            });

            const data = await resp.json();

            if (!resp.ok || !data.url) {
                throw new Error(data.error || 'Payment service unavailable');
            }

            /* --- Redirect to Stripe Checkout --- */
            window.location.href = data.url;

        } catch (err) {
            _toast('Payment error: ' + err.message, 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Pay with Stripe →';
            }
        }
    }

    /* ---- Show toast if user cancelled on Stripe and returned ---- */
    function _handleCancelledReturn() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('cancelled') === '1') {
            setTimeout(() => {
                _toast('Payment was cancelled — your dates are still available.', 'error');
                // Clean URL
                history.replaceState({}, '', window.location.pathname);
            }, 500);
        }
    }

    /* ---- Helpers ---- */
    function _val(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function _toast(msg, type) {
        if (window.RentalBooking && window.RentalBooking.showToast) {
            window.RentalBooking.showToast(msg, type);
        } else {
            alert(msg);
        }
    }

})();
