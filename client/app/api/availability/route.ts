import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('date')
      .gte('date', new Date().toISOString().split('T')[0]);

    if (error) throw error;
    const dates = (data ?? []).map((row: { date: string }) => row.date);
    return NextResponse.json({ dates });
  } catch (e: unknown) {
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}
