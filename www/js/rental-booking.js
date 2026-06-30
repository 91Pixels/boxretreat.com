/* ============================================================
   rental-booking.js — Complete Booking Engine
   Depends on: rental-data.js (PROPERTY, RentalStore, RentalUtils)
   ============================================================ */
(function () {
    'use strict';

    /* ---- Booking state ---- */
    const state = {
        checkIn: null,
        checkOut: null,
        guests: 2,
        step: 1,
        galleryIdx: 0
    };

    /* ---- Shorthand selectors ---- */
    const $ = (id) => document.getElementById(id);
    const $$ = (sel) => document.querySelectorAll(sel);
    const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

    /* ==========================================================
       INIT
    ========================================================== */
    document.addEventListener('DOMContentLoaded', function () {
        buildGallery();
        initGalleryLightbox();
        initDatePicker();
        initGuestCounter();
        initWidget();
        buildAvailabilityCalendar();
        initSaveButton();
        initBookingModal();
    });

    /* ==========================================================
       GALLERY BUILD
    ========================================================== */
    function buildGallery() {
        const wrap = $('gallery-wrap');
        if (!wrap) return;
        const imgs = PROPERTY.images;

        // Main cell
        const main = document.createElement('div');
        main.className = 'gallery-cell gallery-main-cell';
        main.innerHTML = `<img src="${imgs[0].url}" alt="${imgs[0].alt}" loading="lazy">`;
        on(main, 'click', () => openLightbox(0));
        wrap.appendChild(main);

        // 4 thumbnails
        imgs.slice(1, 5).forEach((img, i) => {
            const cell = document.createElement('div');
            cell.className = 'gallery-cell';
            cell.innerHTML = `<img src="${img.url}" alt="${img.alt}" loading="lazy">`;
            on(cell, 'click', () => openLightbox(i + 1));
            wrap.appendChild(cell);
        });

        // "Show all" button
        const btn = document.createElement('button');
        btn.className = 'gallery-show-all';
        btn.innerHTML = '<i class="fa fa-th-large"></i> Show all photos';
        on(btn, 'click', () => openLightbox(0));
        wrap.parentElement.appendChild(btn);
    }

    /* ==========================================================
       GALLERY LIGHTBOX
    ========================================================== */
    function initGalleryLightbox() {
        const overlay = $('gallery-overlay');
        if (!overlay) return;

        // Build thumb strip
        const strip = $('gal-thumb-strip');
        if (strip) {
            PROPERTY.images.forEach((img, i) => {
                const t = document.createElement('div');
                t.className = 'gal-thumb-mini' + (i === 0 ? ' active' : '');
                t.innerHTML = `<img src="${img.url}" alt="${img.alt}">`;
                on(t, 'click', () => setLightboxImg(i));
                strip.appendChild(t);
            });
        }

        on($('gal-close'), 'click', closeLightbox);
        on($('gal-prev'), 'click', () => setLightboxImg(state.galleryIdx - 1));
        on($('gal-next'), 'click', () => setLightboxImg(state.galleryIdx + 1));

        document.addEventListener('keydown', (e) => {
            if (!overlay || overlay.style.display === 'none') return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') setLightboxImg(state.galleryIdx - 1);
            if (e.key === 'ArrowRight') setLightboxImg(state.galleryIdx + 1);
        });
    }

    function openLightbox(idx) {
        const overlay = $('gallery-overlay');
        if (!overlay) return;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setLightboxImg(idx);
    }

    function closeLightbox() {
        const overlay = $('gallery-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = '';
    }

    function setLightboxImg(idx) {
        const imgs = PROPERTY.images;
        state.galleryIdx = (idx + imgs.length) % imgs.length;
        const img = $('gal-main-img');
        if (img) { img.src = imgs[state.galleryIdx].url; img.alt = imgs[state.galleryIdx].alt; }
        const cap = $('gal-caption');
        if (cap) cap.textContent = imgs[state.galleryIdx].alt;
        const counter = $('gal-counter');
        if (counter) counter.textContent = `${state.galleryIdx + 1} / ${imgs.length}`;
        $$('.gal-thumb-mini').forEach((t, i) => t.classList.toggle('active', i === state.galleryIdx));
    }

    /* ==========================================================
       FLATPICKR DATE PICKER
    ========================================================== */
    let fp; // flatpickr instance

    function initDatePicker() {
        const ciEl = $('bw-checkin');
        if (!ciEl || typeof flatpickr === 'undefined') return;

        const disabled = RentalStore.getAllDisabledDates();

        fp = flatpickr(ciEl, {
            mode: 'range',
            minDate: 'today',
            disable: disabled,
            dateFormat: 'M j, Y',
            showMonths: window.innerWidth > 900 ? 2 : 1,
            disableMobile: false,
            onClose: function (selectedDates) {
                if (selectedDates.length === 2) {
                    handleDateSelection(selectedDates[0], selectedDates[1]);
                } else if (selectedDates.length === 1) {
                    state.checkIn = selectedDates[0];
                    state.checkOut = null;
                    setText('bw-checkout', '');
                    updateBreakdown();
                }
            },
            onChange: function (selectedDates) {
                if (selectedDates.length >= 1) {
                    ciEl.value = RentalUtils.formatDate(selectedDates[0]);
                }
                if (selectedDates.length === 2) {
                    const el = $('bw-checkout');
                    if (el) el.value = RentalUtils.formatDate(selectedDates[1]);
                }
            }
        });

        // Checkout click also opens picker
        on($('bw-checkout'), 'click', () => fp && fp.open());
        on($('bw-date-checkin'), 'click', () => fp && fp.open());
        on($('bw-date-checkout'), 'click', () => fp && fp.open());
    }

    function handleDateSelection(start, end) {
        const nights = RentalUtils.nightsBetween(start, end);
        if (nights < PROPERTY.minNights) {
            showToast(`Minimum stay is ${PROPERTY.minNights} nights`, 'error');
            fp && fp.clear();
            return;
        }
        if (rangeHasBlocked(start, end)) {
            showToast('That range includes unavailable dates — please choose another', 'error');
            fp && fp.clear();
            return;
        }
        state.checkIn  = start;
        state.checkOut = end;
        setText('bw-checkin',  RentalUtils.formatDate(start));
        setText('bw-checkout', RentalUtils.formatDate(end));
        updateBreakdown();
    }

    function rangeHasBlocked(start, end) {
        const disabled = RentalStore.getAllDisabledDates();
        const cur = new Date(start);
        cur.setDate(cur.getDate() + 1);
        while (cur < end) {
            if (disabled.includes(cur.toISOString().split('T')[0])) return true;
            cur.setDate(cur.getDate() + 1);
        }
        return false;
    }

    /* ==========================================================
       GUEST COUNTER
    ========================================================== */
    function initGuestCounter() {
        const minus = $('bw-guests-minus');
        const plus  = $('bw-guests-plus');

        function refresh() {
            setText('bw-guest-num', state.guests);
            setText('bw-guest-display', `${state.guests} guest${state.guests > 1 ? 's' : ''}`);
            if (minus) minus.disabled = state.guests <= PROPERTY.minGuests;
            if (plus)  plus.disabled  = state.guests >= PROPERTY.maxGuests;
        }

        on(minus, 'click', () => { if (state.guests > PROPERTY.minGuests) { state.guests--; refresh(); } });
        on(plus,  'click', () => { if (state.guests < PROPERTY.maxGuests) { state.guests++; refresh(); } });
        refresh();
    }

    /* ==========================================================
       PRICE BREAKDOWN (widget)
    ========================================================== */
    function updateBreakdown() {
        const bd = $('price-breakdown');
        const price = RentalUtils.calcPrice(state.checkIn, state.checkOut, RentalStore.getCurrentPrice());
        if (!price) { if (bd) bd.style.display = 'none'; return; }

        if (bd) bd.style.display = 'block';
        setText('pb-nights-label', `${RentalUtils.formatMoney(price.pricePerNight)} × ${price.nights} night${price.nights > 1 ? 's' : ''}`);
        setText('pb-nights-val',   RentalUtils.formatMoney(price.base));
        setText('pb-clean-val',    RentalUtils.formatMoney(price.clean));
        setText('pb-svc-val',      RentalUtils.formatMoney(price.svc));
        setText('pb-taxes-val',    RentalUtils.formatMoney(price.taxes));
        setText('pb-total-val',    RentalUtils.formatMoney(price.total));
    }

    /* ==========================================================
       WIDGET INIT
    ========================================================== */
    function initWidget() {
        setText('bw-price-display', RentalUtils.formatMoney(RentalStore.getCurrentPrice()));
        on($('btn-reserve'), 'click', () => {
            if (!state.checkIn || !state.checkOut) {
                showToast('Select your dates first', 'error');
                fp && fp.open();
                return;
            }
            openModal();
        });
    }

    /* ==========================================================
       AVAILABILITY CALENDAR (inline display section)
    ========================================================== */
    function buildAvailabilityCalendar() {
        const el = $('availability-calendar');
        if (!el || typeof flatpickr === 'undefined') return;
        const disabled = RentalStore.getAllDisabledDates();

        flatpickr(el, {
            inline: true,
            mode: 'range',
            minDate: 'today',
            disable: disabled,
            showMonths: window.innerWidth > 900 ? 2 : 1,
            disableMobile: true,
            onClose: function (selectedDates) {
                if (selectedDates.length === 2) {
                    handleDateSelection(selectedDates[0], selectedDates[1]);
                    // Scroll to booking widget smoothly
                    const widget = $('booking-widget');
                    if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    /* ==========================================================
       SAVE BUTTON
    ========================================================== */
    function initSaveButton() {
        const btn = $('btn-save');
        if (!btn) return;
        refreshSaveBtn(btn);
        on(btn, 'click', () => {
            const saved = RentalStore.toggleSaved();
            refreshSaveBtn(btn);
            showToast(saved ? 'Saved to your wishlist ♥' : 'Removed from wishlist');
        });
    }

    function refreshSaveBtn(btn) {
        const saved = RentalStore.isSaved();
        const icon = btn.querySelector('.fa');
        if (icon) { icon.className = `fa fa-heart${saved ? '' : '-o'}`; icon.style.color = saved ? '#e31c5f' : ''; }
        const span = btn.querySelector('span');
        if (span) span.textContent = saved ? 'Saved' : 'Save';
        btn.classList.toggle('saved', saved);
    }

    /* ==========================================================
       BOOKING MODAL
    ========================================================== */
    function initBookingModal() {
        const overlay = $('booking-overlay');
        on(overlay, 'click', (e) => { if (e.target === overlay) closeModal(); });
        on($('bm-close'), 'click', closeModal);

        on($('btn-step1-next'), 'click', () => goStep(2));
        on($('btn-step2-back'), 'click', () => goStep(1));
        on($('btn-step2-next'), 'click', () => {
            if (!validateContact()) return;
            populateConfirmStep();
            goStep(3);
        });
        on($('btn-step3-back'), 'click', () => goStep(2));
        on($('btn-step3-confirm'), 'click', confirmReservation);

        on($('bm-change-dates'), 'click', () => { closeModal(); fp && fp.open(); });
    }

    function openModal() {
        populateModalSummary();
        goStep(1);
        const overlay = $('booking-overlay');
        if (overlay) { overlay.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    }

    function closeModal() {
        const overlay = $('booking-overlay');
        if (overlay) { overlay.style.display = 'none'; document.body.style.overflow = ''; }
    }

    function goStep(n) {
        state.step = n;
        $$('.bm-step').forEach((el) => el.classList.remove('active'));
        const s = $(`bm-step-${n}`);
        if (s) s.classList.add('active');
        $$('.bm-step-ind').forEach((el, i) => {
            el.classList.remove('active', 'done');
            if (i + 1 === n) el.classList.add('active');
            else if (i + 1 < n) el.classList.add('done');
        });
        // Update header title
        const titles = ['Your trip', 'Contact info', 'Confirm & pay', 'Booking confirmed!'];
        setText('bm-title', titles[n - 1] || 'Reservation');
    }

    function populateModalSummary() {
        const price = RentalUtils.calcPrice(state.checkIn, state.checkOut, RentalStore.getCurrentPrice());
        if (!price) return;

        // Trip summary
        setText('bm-ci-display',    RentalUtils.formatDate(state.checkIn));
        setText('bm-co-display',    RentalUtils.formatDate(state.checkOut));
        setText('bm-nights-display',`${price.nights} night${price.nights > 1 ? 's' : ''}`);
        setText('bm-guests-display',`${state.guests} guest${state.guests > 1 ? 's' : ''}`);

        // Price rows
        setText('bm-pb-nights-label', `${RentalUtils.formatMoney(price.pricePerNight)} × ${price.nights} night${price.nights > 1 ? 's' : ''}`);
        setText('bm-pb-nights-val',   RentalUtils.formatMoney(price.base));
        setText('bm-pb-clean-val',    RentalUtils.formatMoney(price.clean));
        setText('bm-pb-svc-val',      RentalUtils.formatMoney(price.svc));
        setText('bm-pb-taxes-val',    RentalUtils.formatMoney(price.taxes));
        setText('bm-pb-total-val',    RentalUtils.formatMoney(price.total));
    }

    function validateContact() {
        const name  = getVal('contact-name');
        const email = getVal('contact-email');
        const phone = getVal('contact-phone');
        if (!name)  { showToast('Please enter your full name', 'error'); $('contact-name').focus(); return false; }
        if (!email || !email.includes('@')) { showToast('Please enter a valid email', 'error'); $('contact-email').focus(); return false; }
        if (!phone) { showToast('Please enter your phone number', 'error'); $('contact-phone').focus(); return false; }
        return true;
    }

    function populateConfirmStep() {
        const price = RentalUtils.calcPrice(state.checkIn, state.checkOut, RentalStore.getCurrentPrice());
        if (!price) return;

        setText('conf-name',    getVal('contact-name'));
        setText('conf-email',   getVal('contact-email'));
        setText('conf-checkin', RentalUtils.formatDate(state.checkIn));
        setText('conf-checkout',RentalUtils.formatDate(state.checkOut));
        setText('conf-nights',  `${price.nights} night${price.nights > 1 ? 's' : ''}`);
        setText('conf-guests',  `${state.guests} guest${state.guests > 1 ? 's' : ''}`);
        setText('conf-total',   RentalUtils.formatMoney(price.total));
    }

    function confirmReservation() {
        const price = RentalUtils.calcPrice(state.checkIn, state.checkOut, RentalStore.getCurrentPrice());
        if (!price) return;

        const res = {
            id:          RentalUtils.genId(),
            name:        getVal('contact-name'),
            email:       getVal('contact-email'),
            phone:       getVal('contact-phone'),
            notes:       getVal('contact-notes'),
            checkIn:     state.checkIn.toISOString().split('T')[0],
            checkOut:    state.checkOut.toISOString().split('T')[0],
            guests:      state.guests,
            nights:      price.nights,
            pricePerNight: price.pricePerNight,
            cleaningFee: price.clean,
            serviceFee:  price.svc,
            taxes:       price.taxes,
            total:       price.total,
            status:      'confirmed',
            createdAt:   new Date().toISOString()
        };

        RentalStore.addReservation(res);

        // Show confirmation step
        setText('conf-booking-id', res.id);
        goStep(4);
        showConfirmationStep(res, price);

        // Reset widget state
        state.checkIn  = null;
        state.checkOut = null;
        setText('bw-checkin',  '');
        setText('bw-checkout', '');
        const bd = $('price-breakdown');
        if (bd) bd.style.display = 'none';
        fp && fp.clear();
    }

    function showConfirmationStep(res, price) {
        setText('success-id',       res.id);
        setText('success-name',     res.name);
        setText('success-email',    res.email);
        setText('success-checkin',  RentalUtils.formatDate(new Date(res.checkIn  + 'T12:00:00')));
        setText('success-checkout', RentalUtils.formatDate(new Date(res.checkOut + 'T12:00:00')));
        setText('success-nights',   `${res.nights} night${res.nights > 1 ? 's' : ''}`);
        setText('success-guests',   `${res.guests} guest${res.guests > 1 ? 's' : ''}`);
        setText('success-total',    RentalUtils.formatMoney(res.total));
    }

    /* ==========================================================
       TOAST NOTIFICATION
    ========================================================== */
    function showToast(msg, type) {
        let t = document.querySelector('.toast');
        if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
        t.textContent = msg;
        t.className = 'toast' + (type ? ' ' + type : '');
        void t.offsetWidth;
        t.classList.add('show');
        clearTimeout(t._t);
        t._t = setTimeout(() => t.classList.remove('show'), 3200);
    }

    /* ==========================================================
       HELPERS
    ========================================================== */
    function setText(id, val) { const e = $(id); if (e) e.textContent = val; }
    function getVal(id)  { const e = $(id); return e ? e.value.trim() : ''; }

    /* ---- Expose for admin page and rental-stripe.js ---- */
    window.RentalBooking = { showToast, getState: () => state };

})();
