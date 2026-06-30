import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/gear-availability/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/lockers', () => ({
  checkLockerAvailability: vi.fn(),
}));

import { checkLockerAvailability } from '@/lib/lockers';
const mockCheck = vi.mocked(checkLockerAvailability);

function makeReq(params: Record<string, string>) {
  const url = new URL('http://localhost/api/gear-availability');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

describe('GET /api/gear-availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when params missing', async () => {
    const res = await GET(makeReq({ itemId: 'surfboard' }));
    expect(res.status).toBe(400);
  });

  it('returns configured:true, available:true when lockers exist and free', async () => {
    mockCheck.mockResolvedValue({ configured: true, available: true, count: 2 });
    const res = await GET(makeReq({ itemId: 'surfboard', startDate: '2026-08-01', endDate: '2026-08-05' }));
    const body = await res.json();
    expect(body).toEqual({ configured: true, available: true, count: 2 });
  });

  it('returns configured:true, available:false when lockers exist but all booked', async () => {
    mockCheck.mockResolvedValue({ configured: true, available: false, count: 0 });
    const res = await GET(makeReq({ itemId: 'surfboard', startDate: '2026-08-01', endDate: '2026-08-05' }));
    const body = await res.json();
    expect(body).toEqual({ configured: true, available: false, count: 0 });
  });

  it('returns configured:false, available:true when no lockers configured', async () => {
    mockCheck.mockResolvedValue({ configured: false, available: true, count: 0 });
    const res = await GET(makeReq({ itemId: 'surfboard', startDate: '2026-08-01', endDate: '2026-08-05' }));
    const body = await res.json();
    expect(body).toEqual({ configured: false, available: true, count: 0 });
  });

  it('returns 500 on error', async () => {
    mockCheck.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq({ itemId: 'surfboard', startDate: '2026-08-01', endDate: '2026-08-05' }));
    expect(res.status).toBe(500);
  });
});
