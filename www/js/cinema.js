/**
 * cinema.js — BoxRetreat Cinematic Scroll & Animation Engine
 * Mobile-first · 60fps · IntersectionObserver + rAF parallax
 */
(function () {
    'use strict';

    /* ══════════════════════════════════════════
       INIT SEQUENCE
    ══════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', function () {
        initBodyReveal();
        initNav();
        initHero();
        initScrollReveal();
        initParallax();
        initScrollProgress();
        initMobileMenu();
        initProductGrid();
        initRatingBars();
        initSmoothAnchorScroll();
    });

    /* ══════════════════════════════════════════
       BODY REVEAL (remove loading state)
    ══════════════════════════════════════════ */
    function initBodyReveal() {
        document.body.classList.remove('is-loading');
        document.body.classList.add('is-ready');
    }

    /* ══════════════════════════════════════════
       NAVIGATION — transparent ↔ solid on scroll
    ══════════════════════════════════════════ */
    function initNav() {
        const nav       = document.getElementById('site-nav');
        const hero      = document.getElementById('hero');
        if (!nav) return;

        nav.classList.add('nav-transparent');

        function updateNav() {
            const scrollY     = window.scrollY || window.pageYOffset;
            const heroBottom  = hero ? hero.offsetHeight - 80 : 0;
            const isOverHero  = scrollY < heroBottom;

            if (isOverHero) {
                nav.classList.add('nav-transparent');
                nav.classList.remove('nav-solid', 'nav-light');
            } else {
                nav.classList.remove('nav-transparent');
                nav.classList.add('nav-solid');
                nav.classList.remove('nav-light');
            }
        }

        window.addEventListener('scroll', updateNav, { passive: true });
        updateNav();
    }

    /* ══════════════════════════════════════════
       HERO — staggered entrance animation
    ══════════════════════════════════════════ */
    function initHero() {
        const hero = document.getElementById('hero');
        if (!hero) return;

        // Slight delay so the first paint lands, THEN animate
        requestAnimationFrame(() => {
            setTimeout(() => {
                hero.classList.add('hero-ready');
            }, 120);
        });

        // Subtle mouse-parallax on hero bg (desktop only)
        if (window.matchMedia('(pointer: fine)').matches) {
            const bg = hero.querySelector('.hero-bg-img, .hero-video');
            if (!bg) return;

            hero.addEventListener('mousemove', function (e) {
                const rect = hero.getBoundingClientRect();
                const cx   = rect.width  / 2;
                const cy   = rect.height / 2;
                const dx   = (e.clientX - cx) / cx; // -1 to 1
                const dy   = (e.clientY - cy) / cy;
                bg.style.transform = `scale(1.08) translateX(${dx * -8}px) translateY(${dy * -6}px)`;
            }, { passive: true });

            hero.addEventListener('mouseleave', function () {
                bg.style.transform = '';
            });
        }
    }

    /* ══════════════════════════════════════════
       MOBILE MENU
    ══════════════════════════════════════════ */
    function initMobileMenu() {
        const hamburger = document.querySelector('.nav-hamburger');
        const menu      = document.querySelector('.nav-mobile-menu');
        const body      = document.body;
        if (!hamburger || !menu) return;

        hamburger.addEventListener('click', function () {
            const isOpen = body.classList.toggle('nav-open');
            hamburger.setAttribute('aria-expanded', isOpen);
            // Prevent body scroll while menu is open
            body.style.overflow = isOpen ? 'hidden' : '';
        });

        // Close on link click
        menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function () {
                body.classList.remove('nav-open');
                body.style.overflow = '';
            });
        });

        // Close on outside click / ESC
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && body.classList.contains('nav-open')) {
                body.classList.remove('nav-open');
                body.style.overflow = '';
            }
        });
    }

    /* ══════════════════════════════════════════
       SCROLL REVEAL — IntersectionObserver
    ══════════════════════════════════════════ */
    function initScrollReveal() {
        const targets = document.querySelectorAll('.reveal, .stagger-children, .lifestyle-cell');

        if (!targets.length) return;

        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    io.unobserve(entry.target);
                }
            });
        }, {
            threshold:  0.12,
            rootMargin: '0px 0px -40px 0px',
        });

        targets.forEach(function (el) { io.observe(el); });
    }

    /* ══════════════════════════════════════════
       PARALLAX — rAF-based, iOS-safe
    ══════════════════════════════════════════ */
    function initParallax() {
        // Skip on mobile/touch — parallax causes jank
        if (window.matchMedia('(max-width: 768px)').matches) return;

        const parallaxItems = document.querySelectorAll('[data-parallax]');
        if (!parallaxItems.length) return;

        let ticking = false;

        function updateParallax() {
            const scrollY = window.scrollY || window.pageYOffset;

            parallaxItems.forEach(function (el) {
                const speed  = parseFloat(el.dataset.parallax) || 0.3;
                const rect   = el.getBoundingClientRect();
                const center = rect.top + rect.height / 2;
                const vhc    = window.innerHeight / 2;
                const offset = (center - vhc) * speed;

                el.style.transform = `translateY(${offset}px)`;
            });

            ticking = false;
        }

        window.addEventListener('scroll', function () {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        }, { passive: true });
    }

    /* ══════════════════════════════════════════
       SCROLL PROGRESS BAR
    ══════════════════════════════════════════ */
    function initScrollProgress() {
        const bar = document.querySelector('.scroll-progress');
        if (!bar) return;

        let ticking = false;

        window.addEventListener('scroll', function () {
            if (!ticking) {
                requestAnimationFrame(function () {
                    const scrollTop   = window.scrollY || window.pageYOffset;
                    const docHeight   = document.documentElement.scrollHeight - window.innerHeight;
                    const pct         = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
                    bar.style.width   = pct.toFixed(1) + '%';
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }

    /* ══════════════════════════════════════════
       PRODUCT GRID — dynamic from PROPERTY data
    ══════════════════════════════════════════ */
    function initProductGrid() {
        const grid = document.getElementById('cinema-product-grid');
        if (!grid) return;

        // Products from PROPERTY constant (rental-data.js) or default fallback
        const products = (typeof PROPERTY !== 'undefined' && PROPERTY.shopProducts)
            ? PROPERTY.shopProducts
            : [
                { name: 'BoxRetreat T-Shirt',    category: 'Apparel', price: 28, badge: 'Bestseller',
                  img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop&q=80' },
                { name: 'Surf Wax (3-pack)',      category: 'Surf',    price: 15,
                  img: 'https://images.unsplash.com/photo-1526411426665-f4477c50b1e0?w=400&h=400&fit=crop&q=80' },
                { name: 'Beach Tote Bag',         category: 'Apparel', price: 22,
                  img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop&q=80' },
                { name: 'Snorkel Set',            category: 'Water Sports', price: 45, badge: 'New',
                  img: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=400&fit=crop&q=80' },
                { name: 'BoxRetreat Cap',         category: 'Apparel', price: 24,
                  img: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&h=400&fit=crop&q=80' },
                { name: 'Surfboard (day rental)', category: 'Surf',    price: 35, badge: 'Popular',
                  img: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=400&h=400&fit=crop&q=80' },
            ];

        grid.innerHTML = products.map(function (p) {
            return `
            <a href="shop.html" class="product-card-cinema reveal">
                <div class="pc-image">
                    <img src="${p.img}" alt="${p.name}" loading="lazy" />
                    ${p.badge ? `<span class="pc-badge">${p.badge}</span>` : ''}
                </div>
                <div class="pc-info">
                    <p class="pc-cat">${p.category}</p>
                    <p class="pc-name">${p.name}</p>
                    <p class="pc-price">$${p.price}</p>
                </div>
            </a>`;
        }).join('');

        // Re-observe new elements for scroll reveal
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

        grid.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    }

    /* ══════════════════════════════════════════
       RATING BARS — animate on scroll into view
    ══════════════════════════════════════════ */
    function initRatingBars() {
        const fills = document.querySelectorAll('.rcc-cat-fill');
        if (!fills.length) return;

        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    // Width is set in data-width attribute
                    const fill = entry.target;
                    fill.style.width = fill.dataset.width || '100%';
                    io.unobserve(fill);
                }
            });
        }, { threshold: 0.3 });

        fills.forEach(function (fill) { io.observe(fill); });
    }

    /* ══════════════════════════════════════════
       SMOOTH ANCHOR SCROLL (accounts for fixed nav height)
    ══════════════════════════════════════════ */
    function initSmoothAnchorScroll() {
        const NAV_HEIGHT = 80;

        document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
            anchor.addEventListener('click', function (e) {
                const hash   = anchor.getAttribute('href');
                if (hash === '#') return;
                const target = document.querySelector(hash);
                if (!target) return;

                e.preventDefault();
                const top = target.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
                window.scrollTo({ top: top, behavior: 'smooth' });
            });
        });
    }

    /* ══════════════════════════════════════════
       TOAST — global helper
    ══════════════════════════════════════════ */
    window.showToast = function (msg, type) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.className = 'toast show' + (type ? ' ' + type : '');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(function () {
            toast.className = 'toast';
        }, 3200);
    };

})();
