import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/gear-submit-id/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/telegram', () => ({
  sendTelegramPhoto: vi.fn().mockResolvedValue(42),
  sendTelegramMessage: vi.fn().mockResolvedValue(42),
}));

import { createClient } from '@/lib/supabase/server';
const mockCreateClient = vi.mocked(createClient);

function makeSupabase(rental: unknown, uploadError: unknown = null) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  const singleChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: rental, error: null }),
    update: vi.fn().mockReturnValue(updateChain),
  };
  const storage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: uploadError }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/photo.jpg' } }),
    }),
  };
  return {
    from: vi.fn().mockReturnValue(singleChain),
    storage,
  };
}

type MockField = string | { name: string; type: string } | null;

function makeReq(fields: Record<string, MockField>) {
  const req = new NextRequest('http://localhost/api/gear-submit-id', { method: 'POST' });
  // Override formData to avoid undici multipart parser issues with jsdom File objects
  req.formData = async () => {
    const map = new Map<string, unknown>();
    for (const [key, val] of Object.entries(fields)) {
      if (val && typeof val === 'object' && 'name' in val) {
        // Simulate a File object with arrayBuffer support
        const fakeFile = {
          name: val.name,
          type: val.type,
          arrayBuffer: async () => Buffer.from('x').buffer,
        };
        map.set(key, fakeFile);
      } else {
        map.set(key, val);
      }
    }
    return { get: (k: string) => map.get(k) ?? null } as unknown as FormData;
  };
  return req;
}

describe('POST /api/gear-submit-id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_ADMIN_CHAT_ID = '12345';
  });

  it('returns 400 when fields missing', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const req = makeReq({ rentalId: 'GR-001' }); // missing idType, idNumber, photo
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when rental not found', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const req = makeReq({
      rentalId: 'GR-MISSING',
      idType: 'passport',
      idNumber: 'P123456',
      photo: { name: 'id.jpg', type: 'image/jpeg' },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('returns 409 when ID already submitted', async () => {
    const rental = { rental_id: 'GR-001', validation_status: 'id_submitted' };
    mockCreateClient.mockResolvedValue(makeSupabase(rental) as never);
    const req = makeReq({
      rentalId: 'GR-001',
      idType: 'passport',
      idNumber: 'P123',
      photo: { name: 'id.jpg', type: 'image/jpeg' },
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('returns ok:true on success', async () => {
    const rental = {
      rental_id: 'GR-001',
      item_name: 'Surfboard',
      customer_name: 'Jane',
      customer_email: 'jane@test.com',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      item_id: 'surfboard',
      validation_status: 'pending_id',
    };
    mockCreateClient.mockResolvedValue(makeSupabase(rental) as never);
    const req = makeReq({
      rentalId: 'GR-001',
      idType: 'passport',
      idNumber: 'P123',
      photo: { name: 'id.jpg', type: 'image/jpeg' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('returns 500 when photo upload fails', async () => {
    const rental = {
      rental_id: 'GR-001',
      item_name: 'Surfboard',
      customer_name: 'Jane',
      customer_email: 'jane@test.com',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      item_id: 'surfboard',
      validation_status: 'pending_id',
    };
    mockCreateClient.mockResolvedValue(makeSupabase(rental, { message: 'Storage error' }) as never);
    const req = makeReq({
      rentalId: 'GR-001',
      idType: 'passport',
      idNumber: 'P123',
      photo: { name: 'id.jpg', type: 'image/jpeg' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
