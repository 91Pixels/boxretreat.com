import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendReminderEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: rentals } = await supabase
      .from('gear_rentals')
      .select('rental_id, customer_email, customer_name, item_name')
      .eq('status', 'active')
      .eq('validation_status', 'confirmed')
      .is('reminder_sent_at', null)
      .eq('end_date', today);

    if (!rentals || rentals.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No reminders needed' });
    }

    let sent = 0;
    for (const rental of rentals) {
      try {
        await sendReminderEmail({
          to: rental.customer_email,
          customerName: rental.customer_name,
          itemName: rental.item_name,
          rentalId: rental.rental_id,
        });
        await supabase
          .from('gear_rentals')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('rental_id', rental.rental_id);
        sent++;
      } catch (e) {
        console.error(`Reminder failed for ${rental.rental_id}:`, e);
      }
    }

    return NextResponse.json({ sent, total: rentals.length });
  } catch (e: unknown) {
    console.error('Reminder cron error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
