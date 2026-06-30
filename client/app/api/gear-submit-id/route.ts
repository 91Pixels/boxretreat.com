import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramPhoto, sendTelegramMessage } from '@/lib/telegram';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rentalId = formData.get('rentalId') as string | null;
    const idType = formData.get('idType') as string | null;
    const idNumber = formData.get('idNumber') as string | null;
    const photo = formData.get('photo') as File | null;

    if (!rentalId || !idType || !idNumber || !photo) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('rental_id, item_name, customer_name, customer_email, start_date, end_date, item_id, validation_status')
      .eq('rental_id', rentalId)
      .single();

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }
    if (rental.validation_status !== 'pending_id') {
      return NextResponse.json({ error: 'ID already submitted or invalid state' }, { status: 409 });
    }

    // Upload photo to Supabase Storage
    const ext = photo.name.split('.').pop() ?? 'jpg';
    const path = `${rentalId}/id-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from('id-photos')
      .upload(path, buffer, { contentType: photo.type, upsert: false });

    if (uploadErr) {
      console.error('Upload error:', uploadErr);
      return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('id-photos').getPublicUrl(path);
    const idPhotoUrl = urlData.publicUrl;

    // Update rental with ID info
    await supabase.from('gear_rentals').update({
      id_type: idType,
      id_number: idNumber,
      id_photo_url: idPhotoUrl,
      validation_status: 'id_submitted',
      updated_at: new Date().toISOString(),
    }).eq('rental_id', rentalId);

    // Send Telegram notification to admin
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID!;
    const caption =
      `🆔 <b>ID Verification Required</b>\n\n` +
      `📋 Rental: <code>${rentalId}</code>\n` +
      `👤 Customer: ${rental.customer_name}\n` +
      `📧 Email: ${rental.customer_email}\n` +
      `🏄 Gear: ${rental.item_name}\n` +
      `📅 Dates: ${rental.start_date} → ${rental.end_date}\n\n` +
      `🪪 ID Type: ${idType}\n` +
      `🔢 ID Number: ${idNumber}\n\n` +
      `Reply <b>"Validado"</b> to this message to approve and send locker code.`;

    let messageId: number;
    try {
      messageId = await sendTelegramPhoto(adminChatId, idPhotoUrl, caption);
    } catch (telegramErr) {
      console.error('Telegram error:', telegramErr);
      messageId = await sendTelegramMessage(adminChatId, caption);
    }

    await supabase.from('gear_rentals').update({
      telegram_message_id: messageId,
    }).eq('rental_id', rentalId);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error('Submit ID error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
