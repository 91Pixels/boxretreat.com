/**
 * shop.js — Equipment rental cart + Stripe checkout
 */
(function () {
    'use strict';

    /* ── Cart state (persisted to localStorage) ── */
    const CART_KEY = 'br_shop_cart';

    const cart = {
        items: [],

        load() {
            try { this.items = JSON.parse(localStorage.getItem(CART_KEY)) || []; }
            catch { this.items = []; }
        },
        save() {
            localStorage.setItem(CART_KEY, JSON.stringify(this.items));
        },
        add(id, qty = 1) {
            const existing = this.items.find(i => i.id === id);
            const item = SHOP.getById(id);
            if (!item) return;
            const max = item.maxQty;
            if (existing) {
                existing.qty = Math.min(existing.qty + qty, max);
            } else {
                this.items.push({ id, qty: Math.min(qty, max) });
            }
            this.save();
        },
        remove(id) {
            this.items = this.items.filter(i => i.id !== id);
            this.save();
        },
        setQty(id, qty) {
            const existing = this.items.find(i => i.id === id);
            if (!existing) return;
            if (qty <= 0) { this.remove(id); return; }
            const item = SHOP.getById(id);
            existing.qty = Math.min(qty, item?.maxQty || 99);
            this.save();
        },
        clear() { this.items = []; this.save(); },
        get count() { return this.items.reduce((s, i) => s + i.qty, 0); },
        get subtotal() {
            return this.items.reduce((s, i) => {
                const item = SHOP.getById(i.id);
                return s + (item ? item.price * i.qty : 0);
            }, 0);
        },
    };

    /* ── State ── */
    let activeCat = 'all';
    let rentalDates = { checkIn: null, checkOut: null, nights: 0 };

    /* ── DOM helpers ── */
    const $ = id => document.getElementById(id);
    const fmt = n => '$' + Math.round(n).toLocaleString('en-US');

    /* ── Toast ── */
    function toast(msg, type = 'success') {
        const el = $('shop-toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'shop-toast show ' + type;
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), 3000);
    }

    /* ── Render catalog ── */
    function renderCatalog() {
        const grid = $('shop-grid');
        if (!grid) return;
        const items = SHOP.getByCategory(activeCat);

        grid.innerHTML = items.map(item => {
            const cartItem = cart.items.find(i => i.id === item.id);
            const inCart = cartItem ? cartItem.qty : 0;
            const badge = item.badge
                ? `<span class="shop-badge">${item.badge}</span>` : '';
            return `
            <div class="shop-card" data-id="${item.id}">
                <div class="shop-card-img">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" />
                    ${badge}
                </div>
                <div class="shop-card-body">
                    <p class="shop-card-cat">${SHOP.categories.find(c => c.id === item.category)?.label || ''}</p>
                    <h3 class="shop-card-name">${item.name}</h3>
                    <p class="shop-card-tagline">${item.tagline}</p>
                    <p class="shop-card-desc">${item.desc}</p>
                    <div class="shop-card-footer">
                        <span class="shop-card-price">${fmt(item.price)}<span class="shop-card-per">/day</span></span>
                        ${inCart > 0
                            ? `<div class="shop-qty-ctrl">
                                <button class="sq-btn" data-action="minus" data-id="${item.id}">−</button>
                                <span class="sq-num">${inCart}</span>
                                <button class="sq-btn" data-action="plus" data-id="${item.id}">+</button>
                               </div>`
                            : `<button class="shop-add-btn" data-id="${item.id}">Add to cart</button>`
                        }
                    </div>
                </div>
            </div>`;
        }).join('');

        /* Events */
        grid.querySelectorAll('.shop-add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                cart.add(btn.dataset.id);
                renderCatalog();
                updateCartBadge();
                toast(`Added to cart!`);
            });
        });
        grid.querySelectorAll('.sq-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const ci = cart.items.find(i => i.id === id);
                const delta = btn.dataset.action === 'plus' ? 1 : -1;
                cart.setQty(id, (ci?.qty || 0) + delta);
                renderCatalog();
                updateCartBadge();
            });
        });
    }

    /* ── Category tabs ── */
    function initTabs() {
        document.querySelectorAll('.shop-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeCat = btn.dataset.cat;
                renderCatalog();
            });
        });
    }

    /* ── Cart sidebar ── */
    function openCart() {
        renderCartSidebar();
        $('cart-overlay').classList.add('open');
        $('cart-sidebar').classList.add('open');
    }
    function closeCart() {
        $('cart-overlay').classList.remove('open');
        $('cart-sidebar').classList.remove('open');
    }

    function renderCartSidebar() {
        const body = $('cart-body');
        const footer = $('cart-footer');
        if (!body) return;

        if (cart.items.length === 0) {
            body.innerHTML = `<div class="cart-empty"><i class="fa fa-shopping-bag"></i><p>Your cart is empty</p></div>`;
            footer.style.display = 'none';
            return;
        }
        footer.style.display = 'block';

        body.innerHTML = cart.items.map(ci => {
            const item = SHOP.getById(ci.id);
            if (!item) return '';
            const lineTotal = item.price * ci.qty * (rentalDates.nights || 1);
            return `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" />
                <div class="cart-item-info">
                    <strong>${item.name}</strong>
                    <span>${fmt(item.price)}/day × ${ci.qty} × ${rentalDates.nights || '?'} nights</span>
                    <span class="cart-item-total">${fmt(lineTotal)}</span>
                </div>
                <button class="cart-remove" data-id="${item.id}" title="Remove">×</button>
            </div>`;
        }).join('');

        body.querySelectorAll('.cart-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                cart.remove(btn.dataset.id);
                renderCartSidebar();
                renderCatalog();
                updateCartBadge();
            });
        });

        const nights = rentalDates.nights || 1;
        const sub = cart.subtotal * nights;
        const svc = Math.round(sub * 0.14);
        const total = sub + svc;

        $('cart-sub').textContent = fmt(sub);
        $('cart-svc').textContent = fmt(svc);
        $('cart-total').textContent = fmt(total);
        $('cart-nights-note').textContent = rentalDates.nights
            ? `(${rentalDates.nights} nights: ${rentalDates.checkIn} → ${rentalDates.checkOut})`
            : '(select dates below to confirm)';
    }

    function updateCartBadge() {
        const badge = $('cart-badge');
        if (!badge) return;
        const n = cart.count;
        badge.textContent = n;
        badge.style.display = n > 0 ? 'flex' : 'none';
    }

    /* ── Date picker for rental period ── */
    function initDatePicker() {
        const fp = flatpickr('#shop-checkin', {
            mode: 'range',
            minDate: 'today',
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'M j, Y',
            onChange(selected) {
                if (selected.length === 2) {
                    const [a, b] = selected;
                    const nights = Math.round((b - a) / 86400000);
                    rentalDates = {
                        checkIn: a.toISOString().split('T')[0],
                        checkOut: b.toISOString().split('T')[0],
                        nights,
                    };
                    const el = $('shop-nights-display');
                    if (el) el.textContent = `${nights} night${nights !== 1 ? 's' : ''}`;
                }
            },
        });
    }

    /* ── Checkout ── */
    async function checkout() {
        if (cart.items.length === 0) { toast('Your cart is empty', 'error'); return; }
        if (!rentalDates.nights) { toast('Please select your rental dates first', 'error'); return; }

        const btn = $('cart-checkout-btn');
        btn.disabled = true;
        btn.textContent = 'Redirecting…';

        try {
            const nights = rentalDates.nights;
            const lineItems = cart.items.map(ci => {
                const item = SHOP.getById(ci.id);
                return {
                    name: item.name,
                    pricePerUnit: item.price,
                    qty: ci.qty,
                    nights,
                };
            });

            const res = await fetch('/api/create-equipment-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: lineItems,
                    checkIn: rentalDates.checkIn,
                    checkOut: rentalDates.checkOut,
                    nights,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Server error');

            localStorage.setItem('br_pending_equipment', JSON.stringify({
                items: cart.items,
                dates: rentalDates,
                sessionId: data.sessionId,
            }));

            window.location.href = data.url;
        } catch (err) {
            toast('Checkout error: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Checkout →';
        }
    }

    /* ── Init ── */
    function init() {
        cart.load();
        renderCatalog();
        initTabs();
        initDatePicker();
        updateCartBadge();

        $('cart-btn')?.addEventListener('click', openCart);
        $('cart-overlay')?.addEventListener('click', closeCart);
        $('cart-close-btn')?.addEventListener('click', closeCart);
        $('cart-checkout-btn')?.addEventListener('click', checkout);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
