/* ============================================================
   rental-data.js — BoxRetreat Property Data & Storage Layer
   ============================================================ */

const PROPERTY = {
    id: 'boxretreat-luquillo-001',
    name: 'BoxRetreat Luquillo',
    tagline: 'Luxury Container Retreat · Near El Yunque & Luquillo Beach',
    location: {
        address: 'Luquillo, Puerto Rico 00773',
        neighborhood: 'Luquillo',
        lat: 18.3726,
        lng: -65.7198,
        mapNote: '10 min to Luquillo Beach · 15 min to El Yunque · 5 min to town kioscos'
    },
    pricePerNight: 185,
    cleaningFee: 75,
    serviceFeeRate: 0.14,
    taxRate: 0.115,
    maxGuests: 4,
    minGuests: 1,
    minNights: 2,
    bedrooms: 1,
    beds: 2,
    baths: 1,
    checkInTime: '3:00 PM',
    checkOutTime: '11:00 AM',
    rating: 4.97,
    reviewCount: 83,
    superhost: true,

    description: [
        'Escape to BoxRetreat — a meticulously crafted shipping container home nestled in the lush landscape of Luquillo, Puerto Rico. Just minutes from Luquillo Beach and El Yunque National Rainforest, this one-of-a-kind retreat blends industrial chic with tropical comfort.',
        'The 400 sq ft container has been fully renovated with floor-to-ceiling windows that frame breathtaking views of the surrounding palms and mountains. Wake up to the symphony of coquí frogs, brew coffee on your private wraparound deck, then spend the day at Luquillo\'s famous balneario beach — just 10 minutes away.',
        'Return at sunset to grill on the BBQ deck as the sky turns gold over the Caribbean. BoxRetreat is the perfect base for exploring the island: El Yunque hikes, surf lessons, kiosko food, and the vibrant town of Luquillo are all within easy reach.'
    ],

    images: [
        { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&h=900&fit=crop', alt: 'Container exterior with tropical garden' },
        { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=900&h=700&fit=crop', alt: 'Modern open-plan living space' },
        { url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=900&h=700&fit=crop', alt: 'Bedroom with palm view' },
        { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=900&h=700&fit=crop', alt: 'Outdoor deck with hammock at sunset' },
        { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&h=700&fit=crop', alt: 'Fully equipped kitchen' }
    ],

    amenities: [
        { icon: 'fa-wifi',        label: 'Fast WiFi · 300 Mbps',    available: true  },
        { icon: 'fa-snowflake-o', label: 'Air conditioning',         available: true  },
        { icon: 'fa-tv',          label: 'Smart TV · Netflix/HBO',   available: true  },
        { icon: 'fa-cutlery',     label: 'Fully equipped kitchen',   available: true  },
        { icon: 'fa-car',         label: 'Free private parking',     available: true  },
        { icon: 'fa-tint',        label: 'Rain shower · hot water',  available: true  },
        { icon: 'fa-coffee',      label: 'Coffee & tea station',     available: true  },
        { icon: 'fa-umbrella',    label: 'Beach towels & chairs',    available: true  },
        { icon: 'fa-fire',        label: 'Outdoor BBQ grill',        available: true  },
        { icon: 'fa-leaf',        label: 'Private deck & hammock',   available: true  },
        { icon: 'fa-paw',         label: 'Pets allowed',             available: false },
        { icon: 'fa-bath',        label: 'Bathtub',                  available: false }
    ],

    houseRules: [
        { icon: 'fa-sign-in',   label: 'Check-in',    value: 'After 3:00 PM'        },
        { icon: 'fa-sign-out',  label: 'Check-out',   value: 'Before 11:00 AM'      },
        { icon: 'fa-ban',       label: 'Smoking',     value: 'No smoking indoors'   },
        { icon: 'fa-paw',       label: 'Pets',        value: 'No pets'              },
        { icon: 'fa-music',     label: 'Events',      value: 'No parties / events'  },
        { icon: 'fa-moon-o',    label: 'Quiet hours', value: '10 PM – 8 AM'         }
    ],

    host: {
        name: 'Michael',
        since: 'March 2022',
        superhost: true,
        responseRate: 99,
        responseTime: 'within an hour',
        reviews: 83,
        rating: 4.97,
        photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
        about: "Hola! I'm Michael, born and raised in Puerto Rico. I love sharing the magic of this island with visitors from around the world. BoxRetreat is my passion project — a thoughtfully designed space where you can experience Luquillo's natural beauty in style and comfort. I'm always available to help with recommendations, local tips, or anything you need to make your stay unforgettable."
    },

    reviews: [
        {
            author: 'Sarah M.',
            avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face',
            date: 'November 2024',
            rating: 5,
            text: 'Absolutely magical place. The container is modern, impeccably clean, and perfectly designed. Waking up to jungle sounds and a cup of coffee on the deck was unforgettable. Michael is incredibly responsive. 10/10 — would stay again!'
        },
        {
            author: 'Carlos R.',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face',
            date: 'October 2024',
            rating: 5,
            text: 'The perfect getaway. Location is ideal — beach in 10 min, El Yunque in 15. The property is exactly as pictured, even better in person. The deck BBQ nights were a highlight. Will definitely be back!'
        },
        {
            author: 'Jennifer L.',
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&crop=face',
            date: 'September 2024',
            rating: 5,
            text: 'We stayed 5 nights and it wasn\'t enough. Cozy, creative, and spotlessly clean. The hammock on the deck is absolutely dreamy. Michael even left us a welcome basket with local snacks — such a thoughtful touch!'
        },
        {
            author: 'David K.',
            avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face',
            date: 'August 2024',
            rating: 5,
            text: 'Stayed for our anniversary and it was perfect. The design is unique and the space feels luxurious despite being compact. Great WiFi for remote work, and one of the most comfortable beds ever. Highly recommend.'
        }
    ],

    reviewCategories: [
        { label: 'Cleanliness',   score: 4.9 },
        { label: 'Accuracy',      score: 4.8 },
        { label: 'Check-in',      score: 5.0 },
        { label: 'Communication', score: 5.0 },
        { label: 'Location',      score: 4.9 },
        { label: 'Value',         score: 4.8 }
    ]
};

/* ============================================================
   Storage Layer — LocalStorage persistence
   ============================================================ */
const RentalStore = {
    _keys: {
        reservations: 'br_reservations',
        blocked:      'br_blocked_dates',
        price:        'br_price_override',
        saved:        'br_saved'
    },

    /* --- Reservations --- */
    getReservations() {
        try { return JSON.parse(localStorage.getItem(this._keys.reservations) || '[]'); }
        catch (_) { return []; }
    },
    addReservation(res) {
        const all = this.getReservations();
        all.push(res);
        localStorage.setItem(this._keys.reservations, JSON.stringify(all));
        return res;
    },
    updateReservation(id, data) {
        const all = this.getReservations();
        const idx = all.findIndex(r => r.id === id);
        if (idx > -1) {
            all[idx] = Object.assign({}, all[idx], data);
            localStorage.setItem(this._keys.reservations, JSON.stringify(all));
        }
    },
    deleteReservation(id) {
        const all = this.getReservations().filter(r => r.id !== id);
        localStorage.setItem(this._keys.reservations, JSON.stringify(all));
    },

    /* --- Blocked dates (admin) --- */
    getBlockedDates() {
        try { return JSON.parse(localStorage.getItem(this._keys.blocked) || '[]'); }
        catch (_) { return []; }
    },
    setBlockedDates(dates) {
        localStorage.setItem(this._keys.blocked, JSON.stringify(dates));
    },
    addBlockedDate(date) {
        const dates = this.getBlockedDates();
        if (!dates.includes(date)) { dates.push(date); this.setBlockedDates(dates); }
    },
    removeBlockedDate(date) {
        this.setBlockedDates(this.getBlockedDates().filter(d => d !== date));
    },

    /* --- Price override --- */
    getCurrentPrice() {
        const p = parseFloat(localStorage.getItem(this._keys.price));
        return isNaN(p) ? PROPERTY.pricePerNight : p;
    },
    setPrice(price) {
        localStorage.setItem(this._keys.price, price.toString());
    },

    /* --- Saved / wishlist --- */
    isSaved() { return localStorage.getItem(this._keys.saved) === '1'; },
    toggleSaved() {
        const v = this.isSaved() ? '0' : '1';
        localStorage.setItem(this._keys.saved, v);
        return v === '1';
    },

    /* --- Compute all disabled dates (reserved + admin blocked) --- */
    getAllDisabledDates() {
        const blocked = this.getBlockedDates();
        const confirmed = this.getReservations().filter(r => r.status !== 'cancelled');
        const dates = [...blocked];
        confirmed.forEach(res => {
            const cur = new Date(res.checkIn + 'T12:00:00');
            const end = new Date(res.checkOut + 'T12:00:00');
            while (cur < end) {
                dates.push(cur.toISOString().split('T')[0]);
                cur.setDate(cur.getDate() + 1);
            }
        });
        return [...new Set(dates)];
    }
};

/* ============================================================
   Utilities
   ============================================================ */
const RentalUtils = {
    formatDate(date) {
        if (!date) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    formatDateShort(date) {
        if (!date) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    formatMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); },
    parseDate(str) {
        if (!str) return null;
        const d = new Date(str + 'T12:00:00');
        return isNaN(d.getTime()) ? null : d;
    },
    genId() { return 'BR-' + Date.now().toString(36).toUpperCase().slice(-6); },
    nightsBetween(start, end) { return Math.round((end - start) / 86400000); },
    calcPrice(checkIn, checkOut, pricePerNight) {
        if (!checkIn || !checkOut) return null;
        const nights = RentalUtils.nightsBetween(checkIn, checkOut);
        if (nights <= 0) return null;
        const base   = nights * pricePerNight;
        const clean  = PROPERTY.cleaningFee;
        const svc    = Math.round(base * PROPERTY.serviceFeeRate);
        const taxes  = Math.round((base + clean + svc) * PROPERTY.taxRate);
        const total  = base + clean + svc + taxes;
        return { nights, base, clean, svc, taxes, total, pricePerNight };
    }
};
