import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { calculatePricing, nightsBetween, DEFAULT_CONFIG } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { checkIn, checkOut, guests } = body;

    if (!checkIn || !checkOut) {
      return NextResponse.json({ error: 'Missing dates' }, { status: 400 });
    }

    // Get live pricing from Supabase (server-authoritative, not trusting client)
    const supabase = await createClient();
    const { data: configRows } = await supabase
      .from('pricing_config')
      .select('key, value');

    const configMap = Object.fromEntries(
      (configRows ?? []).map((r: { key: string; value: string }) => [r.key, parseFloat(r.value)])
    );

    const config = {
      ...DEFAULT_CONFIG,
      pricePerNight: configMap.price_per_night ?? DEFAULT_CONFIG.pricePerNight,
      cleaningFee: configMap.cleaning_fee ?? DEFAULT_CONFIG.cleaningFee,
      servicePct: (configMap.service_fee_pct ?? 14) / 100,
      taxRate: configMap.tax_rate ?? DEFAULT_CONFIG.taxRate,
    };

    const nights = nightsBetween(checkIn, checkOut);
    const pricing = calculatePricing(nights, config);

    if (!pricing) {
      return NextResponse.json({ error: 'Invalid stay duration' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
    const bookingId = `BR-${Date.now().toString(36).toUpperCase()}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `BoxRetreat — Surf Cabin · ${nights} ${nights === 1 ? 'noche' : 'noches'}`,
              description: `Check-in: ${checkIn} · Check-out: ${checkOut} · ${guests} huéspedes`,
            },
            unit_amount: Math.round(pricing.total * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?cancelled=1`,
      metadata: {
        bookingId,
        checkIn,
        checkOut,
        nights: String(nights),
        guests: String(guests),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e: unknown) {
    console.error('Checkout error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Checkout failed' },
      { status: 500 }
    );
  }
}
