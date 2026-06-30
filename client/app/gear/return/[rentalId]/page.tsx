import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { ReturnClient } from './ReturnClient';
import styles from './return.module.css';

export const metadata = {
  title: 'Return Gear — BoxRetreat',
};

interface Props {
  params: { rentalId: string };
}

export default async function GearReturnPage({ params }: Props) {
  const { rentalId } = params;
  const supabase = await createClient();

  const { data: rental } = await supabase
    .from('gear_rentals')
    .select('rental_id, item_name, status, start_date, end_date, deposit_cents')
    .eq('rental_id', rentalId)
    .single();

  if (!rental) {
    return (
      <>
        <Nav />
        <div className={styles.notFoundWrap}>
          Rental not found. Check the link and try again.
        </div>
        <Footer />
      </>
    );
  }

  const returnSubmitted = rental.status === 'returned' || rental.status === 'completed';

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

  return (
    <>
      <Nav />
      <main className={styles.wrap}>
        <div className={styles.inner}>
          <h1 className={styles.title}>Return {rental.item_name}</h1>

          <div className={styles.infoBox}>
            <div className={styles.infoRow}>
              <span>Rental ID</span>
              <span className={styles.infoVal}>{rental.rental_id}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Dates</span>
              <span className={styles.infoVal}>
                {rental.start_date} → {rental.end_date}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span>Deposit to be returned</span>
              <span className={styles.infoVal}>{fmt(rental.deposit_cents)}</span>
            </div>
          </div>

          <ReturnClient
            rentalId={rental.rental_id}
            itemName={rental.item_name}
            returnSubmitted={returnSubmitted}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
