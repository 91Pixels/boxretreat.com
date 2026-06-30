import { NextRequest, NextResponse } from 'next/server';
import { checkLockerAvailability } from '@/lib/lockers';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get('itemId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!itemId || !startDate || !endDate) {
    return NextResponse.json({ error: 'Missing itemId, startDate, or endDate' }, { status: 400 });
  }

  try {
    const result = await checkLockerAvailability(itemId, startDate, endDate);
    return NextResponse.json(result);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error' },
      { status: 500 }
    );
  }
}
