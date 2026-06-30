import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/gear-send-reminder/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendReminderEmail: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { sendReminderEmail } from '@/lib/email';

const mockCreateClient = vi.mocked(createClient);
const mockSendReminder = vi.mocked(sendReminderEmail);

function makeSupabase(rentals: unknown[]) {
  const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
  const result = { data: rentals, error: null };
  const queryChain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue(updateChain),
    // Make the chain thenable so `await chain` resolves to result at any point
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  (queryChain.select as ReturnType<typeof vi.fn>).mockReturnValue(queryChain);
  (queryChain.eq as ReturnType<typeof vi.fn>).mockReturnValue(queryChain);
  (queryChain.is as ReturnType<typeof vi.fn>).mockReturnValue(queryChain);
  return { from: vi.fn().mockReturnValue(queryChain) };
}

describe('GET /api/gear-send-reminder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // In test env, auth check is skipped
    delete process.env.CRON_SECRET;
  });

  it('returns sent:0 when no rentals due today', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase([]) as never);
    const res = await GET(new NextRequest('http://localhost/api/gear-send-reminder'));
    const body = await res.json();
    expect(body.sent).toBe(0);
  });

  it('sends reminder email for each rental due today', async () => {
    const rentals = [
      { rental_id: 'GR-001', customer_email: 'a@test.com', customer_name: 'Alice', item_name: 'Surfboard' },
      { rental_id: 'GR-002', customer_email: 'b@test.com', customer_name: 'Bob', item_name: 'Kayak' },
    ];
    mockCreateClient.mockResolvedValue(makeSupabase(rentals) as never);
    mockSendReminder.mockResolvedValue({ id: 'ok', data: null, error: null } as never);

    const res = await GET(new NextRequest('http://localhost/api/gear-send-reminder'));
    const body = await res.json();
    expect(body.total).toBe(2);
    expect(body.sent).toBe(2);
    expect(mockSendReminder).toHaveBeenCalledTimes(2);
    expect(mockSendReminder).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@test.com' }));
    expect(mockSendReminder).toHaveBeenCalledWith(expect.objectContaining({ to: 'b@test.com' }));
  });

  it('continues sending remaining emails when one fails', async () => {
    const rentals = [
      { rental_id: 'GR-001', customer_email: 'a@test.com', customer_name: 'Alice', item_name: 'Surfboard' },
      { rental_id: 'GR-002', customer_email: 'b@test.com', customer_name: 'Bob', item_name: 'Kayak' },
    ];
    mockCreateClient.mockResolvedValue(makeSupabase(rentals) as never);
    mockSendReminder
      .mockRejectedValueOnce(new Error('Email failed'))
      .mockResolvedValueOnce({ id: 'ok', data: null, error: null } as never);

    const res = await GET(new NextRequest('http://localhost/api/gear-send-reminder'));
    const body = await res.json();
    expect(body.sent).toBe(1);
    expect(body.total).toBe(2);
  });

  it('returns 401 in production without cron secret', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', 'secret123');
    mockCreateClient.mockResolvedValue(makeSupabase([]) as never);

    const res = await GET(new NextRequest('http://localhost/api/gear-send-reminder'));
    expect(res.status).toBe(401);

    vi.unstubAllEnvs();
  });
});
