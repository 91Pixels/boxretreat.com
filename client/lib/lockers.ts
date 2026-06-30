import { createClient } from '@/lib/supabase/server';

export interface LockerRow {
  id: string;
  item_id: string;
  locker_number: number;
  access_code: string;
  description: string | null;
  is_active: boolean;
}

export async function findAvailableLocker(
  itemId: string,
  startDate: string,
  endDate: string
): Promise<LockerRow | null> {
  const supabase = await createClient();

  const { data: allLockers } = await supabase
    .from('lockers')
    .select('*')
    .eq('item_id', itemId)
    .eq('is_active', true)
    .order('locker_number', { ascending: true });

  if (!allLockers || allLockers.length === 0) return null;

  const { data: booked } = await supabase
    .from('gear_rentals')
    .select('locker_id')
    .not('locker_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  const bookedIds = new Set((booked ?? []).map((r: { locker_id: string }) => r.locker_id));
  return (allLockers as LockerRow[]).find(l => !bookedIds.has(l.id)) ?? null;
}

export async function checkLockerAvailability(
  itemId: string,
  startDate: string,
  endDate: string
): Promise<{ configured: boolean; available: boolean; count: number }> {
  const supabase = await createClient();

  const { data: allLockers } = await supabase
    .from('lockers')
    .select('id')
    .eq('item_id', itemId)
    .eq('is_active', true);

  if (!allLockers || allLockers.length === 0) {
    return { configured: false, available: true, count: 0 };
  }

  const { data: booked } = await supabase
    .from('gear_rentals')
    .select('locker_id')
    .not('locker_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  const bookedIds = new Set((booked ?? []).map((r: { locker_id: string }) => r.locker_id));
  const count = (allLockers as { id: string }[]).filter(l => !bookedIds.has(l.id)).length;
  return { configured: true, available: count > 0, count };
}

export async function countAvailableLockers(
  itemId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const supabase = await createClient();

  const { data: allLockers } = await supabase
    .from('lockers')
    .select('id')
    .eq('item_id', itemId)
    .eq('is_active', true);

  if (!allLockers || allLockers.length === 0) return 0;

  const { data: booked } = await supabase
    .from('gear_rentals')
    .select('locker_id')
    .not('locker_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  const bookedIds = new Set((booked ?? []).map((r: { locker_id: string }) => r.locker_id));
  return (allLockers as { id: string }[]).filter(l => !bookedIds.has(l.id)).length;
}

export interface LockerInventoryItem {
  locker: LockerRow;
  status: 'available' | 'reserved' | 'occupied';
  rental: {
    rental_id: string;
    customer_name: string;
    start_date: string;
    end_date: string;
    return_deadline: string | null;
  } | null;
}

export async function getLockerInventory(): Promise<LockerInventoryItem[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: lockers } = await supabase
    .from('lockers')
    .select('*')
    .eq('is_active', true)
    .order('item_id')
    .order('locker_number');

  if (!lockers) return [];

  const { data: activeRentals } = await supabase
    .from('gear_rentals')
    .select('rental_id, customer_name, start_date, end_date, return_deadline, locker_id')
    .not('locker_id', 'is', null)
    .neq('status', 'cancelled')
    .neq('status', 'completed')
    .neq('validation_status', 'pending_payment')
    .neq('validation_status', 'pending_id');

  const rentalByLockerId = new Map(
    (activeRentals ?? []).map((r: { locker_id: string; rental_id: string; customer_name: string; start_date: string; end_date: string; return_deadline: string | null }) => [r.locker_id, r])
  );

  return (lockers as LockerRow[]).map(locker => {
    const rental = rentalByLockerId.get(locker.id) ?? null;
    let status: LockerInventoryItem['status'] = 'available';
    if (rental) {
      status = rental.start_date <= today && rental.end_date >= today ? 'occupied' : 'reserved';
    }
    return { locker, status, rental };
  });
}
