import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rentalId } = body;

    if (!rentalId) {
      return NextResponse.json({ error: 'Missing rentalId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('rental_id, status, deposit_cents, stripe_payment_intent_id')
      .eq('rental_id', rentalId)
      .single();

    if (!rental) {
      return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
    }

    if (rental.status === 'completed') {
      return NextResponse.json({ error: 'Deposit already released' }, { status: 409 });
    }

    if (rental.status !== 'returned') {
      return NextResponse.json({ error: 'Gear not returned yet' }, { status: 409 });
    }

    if (!rental.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No payment intent found for this rental' }, { status: 400 });
    }

    const refund = await stripe.refunds.create({
      payment_intent: rental.stripe_payment_intent_id,
      amount: rental.deposit_cents,
    });

    await supabase
      .from('gear_rentals')
      .update({
        status: 'completed',
        deposit_released_at: new Date().toISOString(),
        inspection_notes: `Deposit $${rental.deposit_cents / 100} refunded via Stripe refund ${refund.id}`,
        updated_at: new Date().toISOString(),
      })
      .eq('rental_id', rentalId);

    return NextResponse.json({ ok: true, refundId: refund.id });
  } catch (e: unknown) {
    console.error('Release deposit error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Refund failed' },
      { status: 500 }
    );
  }
}
