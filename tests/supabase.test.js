/**
 * supabase.test.js — Tests for Supabase auth integration (mocked)
 * Verifies sign-up, sign-in, sign-out, password reset, and session retrieval.
 */

'use strict';

/* ── Mock Supabase client ── */
const mockSession = { user: { id: 'user-123', email: 'guest@test.com' } };
const mockUser    = { id: 'user-123', email: 'guest@test.com', user_metadata: { full_name: 'Test Guest' } };

const mockSupabase = {
    auth: {
        getSession:              jest.fn(),
        signUp:                  jest.fn(),
        signInWithPassword:      jest.fn(),
        signOut:                 jest.fn(),
        resetPasswordForEmail:   jest.fn(),
        onAuthStateChange:       jest.fn(),
    },
};

// Simulate window.supabase.createClient returning our mock
const createClientMock = jest.fn(() => mockSupabase);

// Build an Auth module that mirrors auth.js but works in Node/Jest
function buildAuth() {
    let _sb = null;
    const SUPABASE_URL  = 'https://test.supabase.co';
    const SUPABASE_ANON = 'anon-key-test';

    function sb() {
        if (!_sb) _sb = createClientMock(SUPABASE_URL, SUPABASE_ANON);
        return _sb;
    }

    return {
        async getSession() {
            const c = sb();
            const { data } = await c.auth.getSession();
            return data?.session ?? null;
        },
        async getUser() {
            const session = await this.getSession();
            return session?.user ?? null;
        },
        async signUp(email, password, name) {
            const c = sb();
            const { data, error } = await c.auth.signUp({
                email, password,
                options: { data: { full_name: name } },
            });
            if (error) throw error;
            return data;
        },
        async signIn(email, password) {
            const c = sb();
            const { data, error } = await c.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data;
        },
        async signOut() {
            const c = sb();
            await c.auth.signOut();
        },
        async resetPassword(email) {
            const c = sb();
            const { error } = await c.auth.resetPasswordForEmail(email, {
                redirectTo: 'http://localhost:3000/account.html?reset=1',
            });
            if (error) throw error;
        },
        onAuthChange(cb) {
            const c = sb();
            c.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null));
        },
    };
}

/* ── Tests ── */

describe('Supabase — getSession / getUser', () => {
    let Auth;
    beforeEach(() => {
        jest.clearAllMocks();
        Auth = buildAuth();
    });

    test('getSession returns session when user is logged in', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
        const session = await Auth.getSession();
        expect(session).toEqual(mockSession);
    });

    test('getSession returns null when no session exists', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
        const session = await Auth.getSession();
        expect(session).toBeNull();
    });

    test('getUser returns user object when session is active', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({ data: { session: mockSession } });
        const user = await Auth.getUser();
        expect(user).toEqual(mockSession.user);
        expect(user.email).toBe('guest@test.com');
    });

    test('getUser returns null when not logged in', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
        const user = await Auth.getUser();
        expect(user).toBeNull();
    });
});

describe('Supabase — signUp', () => {
    let Auth;
    beforeEach(() => {
        jest.clearAllMocks();
        Auth = buildAuth();
    });

    test('signUp calls Supabase with email, password, and full_name', async () => {
        mockSupabase.auth.signUp.mockResolvedValue({ data: { user: mockUser }, error: null });
        const result = await Auth.signUp('guest@test.com', 'Password123!', 'Test Guest');
        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
            email: 'guest@test.com',
            password: 'Password123!',
            options: { data: { full_name: 'Test Guest' } },
        });
        expect(result.user).toEqual(mockUser);
    });

    test('signUp throws when Supabase returns an error', async () => {
        const authError = new Error('Email already registered');
        mockSupabase.auth.signUp.mockResolvedValue({ data: null, error: authError });
        await expect(Auth.signUp('dup@test.com', 'pass', 'Dup')).rejects.toThrow('Email already registered');
    });

    test('signUp passes name in user metadata', async () => {
        mockSupabase.auth.signUp.mockResolvedValue({ data: { user: mockUser }, error: null });
        await Auth.signUp('new@test.com', 'pass123', 'Maria Garcia');
        const callArgs = mockSupabase.auth.signUp.mock.calls[0][0];
        expect(callArgs.options.data.full_name).toBe('Maria Garcia');
    });
});

describe('Supabase — signIn', () => {
    let Auth;
    beforeEach(() => {
        jest.clearAllMocks();
        Auth = buildAuth();
    });

    test('signIn calls signInWithPassword with correct credentials', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
            data: { user: mockUser, session: mockSession },
            error: null,
        });
        const result = await Auth.signIn('guest@test.com', 'Password123!');
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
            email: 'guest@test.com',
            password: 'Password123!',
        });
        expect(result.user).toEqual(mockUser);
    });

    test('signIn throws on wrong password', async () => {
        const authError = new Error('Invalid login credentials');
        mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: authError });
        await expect(Auth.signIn('guest@test.com', 'wrong')).rejects.toThrow('Invalid login credentials');
    });

    test('signIn throws on unregistered email', async () => {
        const authError = new Error('Invalid login credentials');
        mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: authError });
        await expect(Auth.signIn('nobody@test.com', 'pass')).rejects.toThrow();
    });
});

describe('Supabase — signOut', () => {
    let Auth;
    beforeEach(() => {
        jest.clearAllMocks();
        Auth = buildAuth();
    });

    test('signOut calls Supabase auth.signOut()', async () => {
        mockSupabase.auth.signOut.mockResolvedValue({});
        await Auth.signOut();
        expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    });
});

describe('Supabase — resetPassword', () => {
    let Auth;
    beforeEach(() => {
        jest.clearAllMocks();
        Auth = buildAuth();
    });

    test('resetPassword calls resetPasswordForEmail with correct address', async () => {
        mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
        await Auth.resetPassword('guest@test.com');
        expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
            'guest@test.com',
            expect.objectContaining({ redirectTo: expect.stringContaining('account.html?reset=1') })
        );
    });

    test('resetPassword throws when Supabase returns an error', async () => {
        mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: new Error('User not found') });
        await expect(Auth.resetPassword('nobody@test.com')).rejects.toThrow('User not found');
    });
});

describe('Supabase — onAuthChange', () => {
    let Auth;
    beforeEach(() => {
        jest.clearAllMocks();
        Auth = buildAuth();
    });

    test('onAuthChange registers a listener with Supabase', () => {
        const cb = jest.fn();
        Auth.onAuthChange(cb);
        expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    });

    test('onAuthChange callback receives user on sign-in event', () => {
        let registeredHandler;
        mockSupabase.auth.onAuthStateChange.mockImplementation((handler) => {
            registeredHandler = handler;
        });
        const cb = jest.fn();
        Auth.onAuthChange(cb);
        // Simulate Supabase firing SIGNED_IN
        registeredHandler('SIGNED_IN', { user: mockUser });
        expect(cb).toHaveBeenCalledWith(mockUser);
    });

    test('onAuthChange callback receives null on sign-out event', () => {
        let registeredHandler;
        mockSupabase.auth.onAuthStateChange.mockImplementation((handler) => {
            registeredHandler = handler;
        });
        const cb = jest.fn();
        Auth.onAuthChange(cb);
        registeredHandler('SIGNED_OUT', null);
        expect(cb).toHaveBeenCalledWith(null);
    });
});
