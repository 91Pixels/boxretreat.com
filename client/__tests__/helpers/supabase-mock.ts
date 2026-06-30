import { vi } from 'vitest';

export interface SupabaseMockOpts {
  singleData?: object | null;
  singleError?: object | null;
  insertError?: object | null;
  updateError?: object | null;
  storageUploadError?: object | null;
  storagePublicUrl?: string;
}

export function makeMockSupabase(opts: SupabaseMockOpts = {}) {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: opts.singleData ?? null,
      error: opts.singleError ?? null,
    }),
  };

  const insertChain = {
    insert: vi.fn().mockResolvedValue({ error: opts.insertError ?? null }),
  };

  const updateChain = {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: opts.updateError ?? null }),
    }),
  };

  const storageBucket = {
    upload: vi.fn().mockResolvedValue({ error: opts.storageUploadError ?? null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: opts.storagePublicUrl ?? 'https://storage.example.com/photo.jpg' },
    }),
  };

  const mockFrom = vi.fn()
    .mockReturnValueOnce(selectChain)
    .mockReturnValueOnce(insertChain)
    .mockReturnValueOnce(updateChain);

  return {
    from: mockFrom,
    storage: { from: vi.fn().mockReturnValue(storageBucket) },
    _selectChain: selectChain,
    _insertChain: insertChain,
    _updateChain: updateChain,
    _storageBucket: storageBucket,
    _mockFrom: mockFrom,
  };
}

export function makeFile(name = 'photo.jpg', type = 'image/jpeg'): File {
  return new File(['fake-image-content'], name, { type });
}

export function makeJsonRequest(url: string, body: object): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function makeFormRequest(url: string, fields: Record<string, string | File | File[]>): Request {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      value.forEach(v => fd.append(key, v));
    } else {
      fd.append(key, value);
    }
  }
  return new Request(url, { method: 'POST', body: fd });
}
