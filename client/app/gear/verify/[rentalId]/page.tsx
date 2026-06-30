import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { VerifyClient } from './VerifyClient';

export const metadata = { title: 'Verify Your Identity — BoxRetreat' };

export default async function VerifyPage({ params }: { params: { rentalId: string } }) {
  const supabase = await createClient();
  const { data: rental } = await supabase
    .from('gear_rentals')
    .select('rental_id, item_name, customer_name, validation_status')
    .eq('rental_id', params.rentalId)
    .single();

  if (!rental) return notFound();

  return (
    <>
      <Nav />
      <VerifyClient
        rentalId={rental.rental_id}
        itemName={rental.item_name}
        alreadySubmitted={
          rental.validation_status === 'id_submitted' ||
          rental.validation_status === 'validated' ||
          rental.validation_status === 'confirmed'
        }
      />
      <Footer />
    </>
  );
}
