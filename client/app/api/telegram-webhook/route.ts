import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findAvailableLocker } from '@/lib/lockers';
import { sendConfirmationEmail } from '@/lib/email';
import { replyTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const text: string = (message?.text ?? '').trim();
    const chatId = String(message?.chat?.id ?? '');
    const messageId: number = message?.message_id;
    const replyToMessageId: number | undefined = message?.reply_to_message?.message_id;

    if (!text.toLowerCase().startsWith('validado')) {
      return NextResponse.json({ ok: true });
    }

    if (!replyToMessageId) {
      await replyTelegramMessage(chatId, messageId, '⚠️ Please reply directly to the ID verification message.');
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();
    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('*')
      .eq('telegram_message_id', replyToMessageId)
      .single();

    if (!rental) {
      await replyTelegramMessage(chatId, messageId, '❌ Rental not found for this message.');
      return NextResponse.json({ ok: true });
    }

    if (rental.validation_status === 'validated' || rental.validation_status === 'confirmed') {
      await replyTelegramMessage(chatId, messageId, `ℹ️ Already validated. Locker was assigned.`);
      return NextResponse.json({ ok: true });
    }

    // Race-condition guard: check availability again
    const locker = await findAvailableLocker(rental.item_id, rental.start_date, rental.end_date);
    if (!locker) {
      await replyTelegramMessage(
        chatId,
        messageId,
        `❌ No lockers available for ${rental.item_name} on ${rental.start_date}–${rental.end_date}!`
      );
      return NextResponse.json({ ok: true });
    }

    const returnDeadline = new Date(`${rental.end_date}T19:00:00Z`).toISOString();

    await supabase.from('gear_rentals').update({
      validation_status: 'validated',
      locker_id: locker.id,
      locker_access_code: locker.access_code,
      return_deadline: returnDeadline,
      updated_at: new Date().toISOString(),
    }).eq('rental_id', rental.rental_id);

    await sendConfirmationEmail({
      to: rental.customer_email,
      customerName: rental.customer_name,
      itemName: rental.item_name,
      lockerNumber: locker.locker_number,
      accessCode: locker.access_code,
      startDate: rental.start_date,
      endDate: rental.end_date,
      rentalId: rental.rental_id,
    });

    await supabase.from('gear_rentals').update({
      validation_status: 'confirmed',
      confirmation_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('rental_id', rental.rental_id);

    await replyTelegramMessage(
      chatId,
      messageId,
      `✅ Validated!\nLocker #${locker.locker_number} (code: ${locker.access_code}) assigned.\nConfirmation email sent to ${rental.customer_email}.`
    );

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('Telegram webhook error:', e);
    return NextResponse.json({ ok: true }); // Always 200 to Telegram
  }
}
