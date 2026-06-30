import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/telegram-webhook/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/lockers', () => ({ findAvailableLocker: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendConfirmationEmail: vi.fn() }));
vi.mock('@/lib/telegram', () => ({ replyTelegramMessage: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { findAvailableLocker } from '@/lib/lockers';
import { sendConfirmationEmail } from '@/lib/email';
import { replyTelegramMessage } from '@/lib/telegram';

const mockCreateClient = vi.mocked(createClient);
const mockFindLocker = vi.mocked(findAvailableLocker);
const mockSendEmail = vi.mocked(sendConfirmationEmail);
const mockReply = vi.mocked(replyTelegramMessage);

function makeBody(text: string, replyToId?: number) {
  return {
    message: {
      message_id: 999,
      chat: { id: 12345 },
      text,
      ...(replyToId != null ? { reply_to_message: { message_id: replyToId } } : {}),
    },
  };
}

function makeSupabase(rentalData: unknown) {
  const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: rentalData, error: null }),
      update: vi.fn().mockReturnValue(updateChain),
    }),
  };
}

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/telegram-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/telegram-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and ignores non-Validado messages', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await POST(makeReq(makeBody('Hello world')));
    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('replies with warning when no reply_to message', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await POST(makeReq(makeBody('Validado')));
    expect(res.status).toBe(200);
    expect(mockReply).toHaveBeenCalledWith('12345', 999, expect.stringContaining('reply directly'));
  });

  it('replies error when rental not found', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await POST(makeReq(makeBody('Validado', 777)));
    expect(res.status).toBe(200);
    expect(mockReply).toHaveBeenCalledWith('12345', 999, expect.stringContaining('not found'));
  });

  it('assigns locker and sends confirmation email on valid Validado reply', async () => {
    const rental = {
      rental_id: 'GR-001',
      item_id: 'surfboard',
      item_name: 'Surfboard',
      customer_name: 'Jane',
      customer_email: 'jane@test.com',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      validation_status: 'id_submitted',
    };
    mockCreateClient.mockResolvedValue(makeSupabase(rental) as never);
    mockFindLocker.mockResolvedValue({
      id: 'lock-1',
      locker_number: 2,
      access_code: '4821',
      item_id: 'surfboard',
      description: null,
      is_active: true,
    });
    mockSendEmail.mockResolvedValue({ id: 'ok', data: null, error: null } as never);

    const res = await POST(makeReq(makeBody('validado', 42)));
    expect(res.status).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'jane@test.com',
      lockerNumber: 2,
      accessCode: '4821',
    }));
    expect(mockReply).toHaveBeenCalledWith('12345', 999, expect.stringContaining('Validated'));
  });

  it('replies no-locker message when all lockers occupied', async () => {
    const rental = {
      rental_id: 'GR-001',
      item_id: 'surfboard',
      item_name: 'Surfboard',
      customer_name: 'Jane',
      customer_email: 'jane@test.com',
      start_date: '2026-08-01',
      end_date: '2026-08-05',
      validation_status: 'id_submitted',
    };
    mockCreateClient.mockResolvedValue(makeSupabase(rental) as never);
    mockFindLocker.mockResolvedValue(null);

    const res = await POST(makeReq(makeBody('Validado', 42)));
    expect(res.status).toBe(200);
    expect(mockReply).toHaveBeenCalledWith('12345', 999, expect.stringContaining('No lockers'));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('handles message with no text field gracefully', async () => {
    mockCreateClient.mockResolvedValue(makeSupabase(null) as never);
    const res = await POST(makeReq({ message: null }));
    expect(res.status).toBe(200);
  });
});
