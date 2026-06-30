/**
 * auth.js — Supabase authentication wrapper
 * Requires config.js (SUPABASE_URL, SUPABASE_ANON) loaded first
 */
(function () {
    'use strict';

    /* ── Supabase client ── */
    let _sb = null;
    function sb() {
        if (!_sb) {
            if (typeof supabase === 'undefined') {
                console.error('Supabase SDK not loaded');
                return null;
            }
            _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
        }
        return _sb;
    }

    /* ── Public API ── */
    window.Auth = {

        async getSession() {
            const c = sb(); if (!c) return null;
            const { data } = await c.auth.getSession();
            return data.session;
        },

        async getUser() {
            const session = await this.getSession();
            return session?.user || null;
        },

        async signUp(email, password, name) {
            const c = sb(); if (!c) throw new Error('Supabase not configured');
            const { data, error } = await c.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } },
            });
            if (error) throw error;
            return data;
        },

        async signIn(email, password) {
            const c = sb(); if (!c) throw new Error('Supabase not configured');
            const { data, error } = await c.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data;
        },

        async signOut() {
            const c = sb(); if (!c) return;
            await c.auth.signOut();
            window.location.href = 'account.html';
        },

        async resetPassword(email) {
            const c = sb(); if (!c) throw new Error('Supabase not configured');
            const { error } = await c.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/account.html?reset=1',
            });
            if (error) throw error;
        },

        /* Fetch reservations for current user (matches by email in localStorage + Supabase) */
        async getMyReservations() {
            const user = await this.getUser();
            if (!user) return [];

            /* Merge localStorage reservations matching this email */
            const all = RentalStore.getReservations();
            return all.filter(r => {
                const email = r.guest?.email || r.email || '';
                return email.toLowerCase() === user.email.toLowerCase();
            });
        },

        /* Fetch equipment orders for current user */
        async getMyOrders() {
            const user = await this.getUser();
            if (!user) return [];
            const all = JSON.parse(localStorage.getItem('br_equipment_orders') || '[]');
            return all.filter(o => o.email === user.email);
        },

        onAuthChange(cb) {
            const c = sb(); if (!c) return;
            c.auth.onAuthStateChange((_event, session) => cb(session?.user || null));
        },
    };
})();
