import { redirect } from 'next/navigation';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

interface Props {
  searchParams: { session_id?: string };
}

export default async function GearSuccessPage({ searchParams }: Props) {
  const sessionId = searchParams.session_id;
  if (!sessionId) redirect('/gear');

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') redirect('/gear');

    const supabase = await createClient();
    const rentalId = session.metadata?.rentalId;
    if (!rentalId) redirect('/gear');

    const { data: rental } = await supabase
      .from('gear_rentals')
      .select('rental_id, validation_status')
      .eq('rental_id', rentalId)
      .single();

    if (!rental) redirect('/gear');

    if (rental.validation_status === 'pending_payment') {
      await supabase
        .from('gear_rentals')
        .update({
          status: 'active',
          stripe_payment_intent_id: session.payment_intent as string,
          validation_status: 'pending_id',
          updated_at: new Date().toISOString(),
        })
        .eq('rental_id', rentalId);
    }

    redirect(`/gear/verify/${rentalId}`);
  } catch (e) {
    console.error('Gear success error:', e);
    redirect('/gear');
  }
}
