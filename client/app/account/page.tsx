import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { AccountClient } from './AccountClient';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let reservations: Array<{ id: string; status: string; check_in: string; check_out: string; nights: number; guests: number; total: number; created_at: string }> = [];
  if (user) {
    const { data } = await supabase
      .from('reservations')
      .select('id, status, check_in, check_out, nights, guests, total, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    reservations = data ?? [];
  }

  return (
    <>
      <Nav />
      <AccountClient user={user} reservations={reservations} />
      <Footer />
    </>
  );
}
