import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await stripe.checkout.sessions.retrieve(params.id);
    return NextResponse.json({
      status: session.payment_status,
      customer_email: session.customer_details?.email ?? '',
      amount_total: session.amount_total,
      metadata: session.metadata,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Session not found' },
      { status: 404 }
    );
  }
}
