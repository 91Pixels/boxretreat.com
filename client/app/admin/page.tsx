import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminClient } from './AdminClient';
import { getLockerInventory, LockerInventoryItem } from '@/lib/lockers';

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in — show login (handled client side)
  // Logged in — check role
  let isAdmin = false;
  if (user) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    isAdmin = data?.role === 'admin';
    if (!isAdmin) redirect('/');
  }

  // Fetch initial data if admin
  let reservations: ReservationRow[] = [];
  let pricingConfig: Record<string, string> = {};
  let blockedDates: string[] = [];
  let gearRentals: GearRentalRow[] = [];
  let lockerInventory: LockerInventoryItem[] = [];

  if (isAdmin) {
    const [resResult, configResult, blockedResult, gearResult, lockerResult] = await Promise.all([
      supabase.from('reservations').select('*').order('created_at', { ascending: false }),
      supabase.from('pricing_config').select('key, value'),
      supabase.from('blocked_dates').select('date').order('date'),
      supabase.from('gear_rentals').select('*').order('created_at', { ascending: false }),
      getLockerInventory(),
    ]);
    reservations = resResult.data ?? [];
    pricingConfig = Object.fromEntries((configResult.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    blockedDates = (blockedResult.data ?? []).map((r: { date: string }) => r.date);
    gearRentals = gearResult.data ?? [];
    lockerInventory = lockerResult;
  }

  return (
    <AdminClient
      user={user}
      isAdmin={isAdmin}
      initialReservations={reservations}
      initialPricingConfig={pricingConfig}
      initialBlockedDates={blockedDates}
      initialGearRentals={gearRentals}
      initialLockerInventory={lockerInventory}
    />
  );
}

export interface GearRentalRow {
  id: string;
  rental_id: string;
  item_name: string;
  customer_name: string;
  customer_email: string;
  start_date: string;
  end_date: string;
  days: number;
  rental_total_cents: number;
  deposit_cents: number;
  grand_total_cents: number;
  status: string;
  locker_code: string | null;
  locker_access_code: string | null;
  validation_status: string;
  id_photo_url: string | null;
  return_deadline: string | null;
  return_photo_urls: string[];
  return_submitted_at: string | null;
  deposit_released_at: string | null;
  created_at: string;
}

export interface ReservationRow {
  id: string;
  status: string;
  guest_name: string;
  guest_email: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total: number;
  created_at: string;
}
