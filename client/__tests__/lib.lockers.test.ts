import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue(mockSupabase),
}));

function makeChain(returnData: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    data: returnData,
    error: null,
  };
  // Make awaitable
  Object.defineProperty(chain, 'then', {
    value: (resolve: (v: unknown) => void) => Promise.resolve({ data: returnData, error: null }).then(resolve),
  });
  return chain;
}

describe('countAvailableLockers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when no lockers exist for item', async () => {
    mockSupabase.from.mockImplementation(() => makeChain([]));
    const { countAvailableLockers } = await import('@/lib/lockers');
    const count = await countAvailableLockers('unicorn', '2026-08-01', '2026-08-05');
    expect(count).toBe(0);
  });

  it('returns total locker count when none are booked', async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call++;
      if (call === 1) return makeChain([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      return makeChain([]);
    });
    const { countAvailableLockers } = await import('@/lib/lockers');
    const count = await countAvailableLockers('surfboard', '2026-08-01', '2026-08-05');
    expect(count).toBe(3);
  });

  it('subtracts booked lockers', async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call++;
      if (call === 1) return makeChain([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      return makeChain([{ locker_id: 'a' }, { locker_id: 'b' }]);
    });
    const { countAvailableLockers } = await import('@/lib/lockers');
    const count = await countAvailableLockers('surfboard', '2026-08-01', '2026-08-05');
    expect(count).toBe(1);
  });
});

describe('findAvailableLocker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no lockers exist', async () => {
    mockSupabase.from.mockImplementation(() => makeChain([]));
    const { findAvailableLocker } = await import('@/lib/lockers');
    const result = await findAvailableLocker('surfboard', '2026-08-01', '2026-08-05');
    expect(result).toBeNull();
  });

  it('returns null when all lockers booked', async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call++;
      if (call === 1) return makeChain([{ id: 'a', locker_number: 1, access_code: '1111', item_id: 'surfboard', description: null, is_active: true }]);
      return makeChain([{ locker_id: 'a' }]);
    });
    const { findAvailableLocker } = await import('@/lib/lockers');
    const result = await findAvailableLocker('surfboard', '2026-08-01', '2026-08-05');
    expect(result).toBeNull();
  });

  it('returns lowest numbered available locker', async () => {
    let call = 0;
    mockSupabase.from.mockImplementation(() => {
      call++;
      if (call === 1) return makeChain([
        { id: 'a', locker_number: 1, access_code: '1111', item_id: 'surfboard', description: null, is_active: true },
        { id: 'b', locker_number: 2, access_code: '2222', item_id: 'surfboard', description: null, is_active: true },
      ]);
      return makeChain([{ locker_id: 'a' }]);
    });
    const { findAvailableLocker } = await import('@/lib/lockers');
    const result = await findAvailableLocker('surfboard', '2026-08-01', '2026-08-05');
    expect(result?.id).toBe('b');
    expect(result?.locker_number).toBe(2);
    expect(result?.access_code).toBe('2222');
  });
});
