import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { getGearItem } from '@/lib/gear';
import { daysBetween } from '@/lib/locker';
import { countAvailableLockers } from '@/lib/lockers';

const DEPOSIT_CENTS = 2000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, startDate, endDate, customerName, customerEmail } = body;

    if (!itemId || !startDate || !endDate || !customerName || !customerEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const item = getGearItem(itemId);
    if (!item) {
      return NextResponse.json({ error: 'Unknown gear item' }, { status: 400 });
    }

    const days = daysBetween(startDate, endDate);
    if (days < 1) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    // Availability guard — must happen before payment
    const available = await countAvailableLockers(itemId, startDate, endDate);
    if (available === 0) {
      return NextResponse.json(
        { error: 'No lockers available for these dates' },
        { status: 409 }
      );
    }

    const dailyRateCents = item.pricePerDay * 100;
    const rentalTotalCents = dailyRateCents * days;
    const grandTotalCents = rentalTotalCents + DEPOSIT_CENTS;
    const rentalId = `GR-${Date.now().toString(36).toUpperCase()}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';

    // return_deadline = end_date at 15:00 Puerto Rico (UTC-4 = 19:00 UTC)
    const returnDeadline = new Date(`${endDate}T19:00:00Z`).toISOString();

    const supabase = await createClient();
    const { error: dbError } = await supabase.from('gear_rentals').insert({
      rental_id: rentalId,
      item_id: itemId,
      item_name: item.name,
      customer_email: customerEmail,
      customer_name: customerName,
      start_date: startDate,
      end_date: endDate,
      days,
      daily_rate_cents: dailyRateCents,
      deposit_cents: DEPOSIT_CENTS,
      rental_total_cents: rentalTotalCents,
      grand_total_cents: grandTotalCents,
      status: 'pending',
      validation_status: 'pending_payment',
      return_deadline: returnDeadline,
    });

    if (dbError) {
      console.error('DB insert error:', dbError);
      return NextResponse.json({ error: 'Could not create rental record' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${item.name} rental · ${days} ${days === 1 ? 'day' : 'days'}`,
              description: `${startDate} → ${endDate}`,
            },
            unit_amount: rentalTotalCents,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Security deposit (refundable within 48h)',
              description: 'Returned automatically after gear inspection.',
            },
            unit_amount: DEPOSIT_CENTS,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/gear/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/gear`,
      metadata: { rentalId },
    });

    await supabase
      .from('gear_rentals')
      .update({ stripe_session_id: session.id })
      .eq('rental_id', rentalId);

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    console.error('Gear checkout error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
