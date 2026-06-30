import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { sendExtensionPaymentEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { rentalId, days, discountAmountCents = 0 } = await req.json();

    if (!rentalId || !days || days < 1) {
      return NextResponse.json({ error: 'Missing rentalId or invalid days' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('*')
      .eq('rental_id', rentalId)
      .eq('status', 'active')
      .single();

    if (!rental) {
      return NextResponse.json({ error: 'Active rental not found' }, { status: 404 });
    }

    const dailyRateCents = rental.daily_rate_cents as number;
    const totalCents = Math.max(50, days * dailyRateCents - discountAmountCents);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: rental.customer_email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${rental.item_name} extension · ${days} extra ${days === 1 ? 'day' : 'days'}`,
              description: `Extends your rental by ${days} days`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/gear/extend/${rentalId}?extended=true`,
      cancel_url: `${baseUrl}/gear/extend/${rentalId}`,
      metadata: { rentalId, extensionDays: String(days), type: 'extension' },
    });

    await supabase.from('gear_rental_extensions').insert({
      rental_id: rentalId,
      extension_days: days,
      daily_rate_cents: dailyRateCents,
      discount_amount_cents: discountAmountCents,
      total_cents: totalCents,
      stripe_session_id: session.id,
    });

    await sendExtensionPaymentEmail({
      to: rental.customer_email,
      customerName: rental.customer_name,
      itemName: rental.item_name,
      extensionDays: days,
      totalCents,
      stripeUrl: session.url!,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e: unknown) {
    console.error('Gear extend error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
