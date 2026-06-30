import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { ExtendClient } from './ExtendClient';

export const metadata = { title: 'Extend Your Rental — BoxRetreat' };

export default async function ExtendPage({ params }: { params: { rentalId: string } }) {
  const supabase = await createClient();
  const { data: rental } = await supabase
    .from('gear_rentals')
    .select('rental_id, item_name, customer_name, end_date, daily_rate_cents, return_deadline')
    .eq('rental_id', params.rentalId)
    .eq('status', 'active')
    .single();

  if (!rental) return notFound();

  return (
    <>
      <Nav />
      <ExtendClient
        rentalId={rental.rental_id}
        itemName={rental.item_name}
        currentEndDate={rental.end_date}
        dailyRateCents={rental.daily_rate_cents}
      />
      <Footer />
    </>
  );
}
