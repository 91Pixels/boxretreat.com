// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { POST } from '@/app/api/gear-return/route';
import { createClient } from '@/lib/supabase/server';
import { makeMockSupabase, makeFile, makeFormRequest } from './helpers/supabase-mock';

vi.mock('@/lib/supabase/server');

const BASE_URL = 'http://localhost/api/gear-return';

const ACTIVE_RENTAL = {
  id: 'uuid-001',
  status: 'active',
  rental_id: 'GR-TEST01',
};

function setupSuccessClient() {
  const mock = makeMockSupabase({
    singleData: ACTIVE_RENTAL,
    storagePublicUrl: 'https://storage.example.com/GR-TEST01/photo.jpg',
  });
  mock._mockFrom
    .mockReset()
    .mockReturnValueOnce(mock._selectChain)
    .mockReturnValueOnce(mock._updateChain);
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('POST /api/gear-return — happy path', () => {
  it('returns 200 { ok: true } when photos are uploaded', async () => {
    setupSuccessClient();
    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('surf.jpg')],
    });
    const res = await POST(req as never);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('uploads each photo to the gear-return-photos bucket', async () => {
    const mock = setupSuccessClient();
    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('a.jpg'), makeFile('b.jpg')],
    });
    await POST(req as never);
    expect(mock._storageBucket.upload).toHaveBeenCalledTimes(2);
    const [path1] = mock._storageBucket.upload.mock.calls[0];
    expect(path1).toMatch(/^GR-TEST01\//);
    expect(path1).toMatch(/\.jpg$/);
  });

  it('updates the rental to status "returned" with photo URLs', async () => {
    const mock = setupSuccessClient();
    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });
    await POST(req as never);
    const updateArg = mock._updateChain.update.mock.calls[0][0];
    expect(updateArg.status).toBe('returned');
    expect(updateArg.return_photo_urls).toEqual([
      'https://storage.example.com/GR-TEST01/photo.jpg',
    ]);
    expect(updateArg.return_submitted_at).toBeTruthy();
  });

  it('stores all URLs when multiple photos uploaded', async () => {
    const mock = makeMockSupabase({ singleData: ACTIVE_RENTAL });
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._selectChain)
      .mockReturnValueOnce(mock._updateChain);
    mock._storageBucket.getPublicUrl
      .mockReturnValueOnce({ data: { publicUrl: 'https://storage.example.com/1.jpg' } })
      .mockReturnValueOnce({ data: { publicUrl: 'https://storage.example.com/2.jpg' } })
      .mockReturnValueOnce({ data: { publicUrl: 'https://storage.example.com/3.jpg' } });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('1.jpg'), makeFile('2.jpg'), makeFile('3.jpg')],
    });
    await POST(req as never);
    const updateArg = mock._updateChain.update.mock.calls[0][0];
    expect(updateArg.return_photo_urls).toHaveLength(3);
    expect(updateArg.return_photo_urls).toContain('https://storage.example.com/2.jpg');
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe('POST /api/gear-return — validation', () => {
  it('returns 400 when rentalId is missing', async () => {
    const req = makeFormRequest(BASE_URL, { photos: [makeFile('photo.jpg')] });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing rentalId or photos/i);
  });

  it('returns 400 when no photos are provided', async () => {
    const req = makeFormRequest(BASE_URL, { rentalId: 'GR-TEST01' });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing rentalId or photos/i);
  });

  it('returns 404 when rental does not exist', async () => {
    const mock = makeMockSupabase({ singleData: null });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-NOTEXIST',
      photos: [makeFile('photo.jpg')],
    });
    const res = await POST(req as never);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/rental not found/i);
  });

  it('returns 409 when rental is already returned', async () => {
    const mock = makeMockSupabase({ singleData: { ...ACTIVE_RENTAL, status: 'returned' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });
    const res = await POST(req as never);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/return already submitted/i);
  });

  it('returns 409 when rental is already completed', async () => {
    const mock = makeMockSupabase({ singleData: { ...ACTIVE_RENTAL, status: 'completed' } });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });
    const res = await POST(req as never);
    expect(res.status).toBe(409);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe('POST /api/gear-return — error paths', () => {
  it('returns 500 when storage upload fails', async () => {
    const mock = makeMockSupabase({
      singleData: ACTIVE_RENTAL,
      storageUploadError: { message: 'Bucket not found' },
    });
    mock._mockFrom.mockReset().mockReturnValueOnce(mock._selectChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });
    const res = await POST(req as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/photo upload failed/i);
  });

  it('returns 500 when Supabase update fails', async () => {
    const mock = makeMockSupabase({
      singleData: ACTIVE_RENTAL,
      updateError: { message: 'Update failed' },
    });
    mock._mockFrom
      .mockReset()
      .mockReturnValueOnce(mock._selectChain)
      .mockReturnValueOnce(mock._updateChain);
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(mock);

    const req = makeFormRequest(BASE_URL, {
      rentalId: 'GR-TEST01',
      photos: [makeFile('photo.jpg')],
    });
    const res = await POST(req as never);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/could not update rental/i);
  });
});
