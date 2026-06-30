import { createClient } from '@/lib/supabase/server';
import { DEFAULT_CONFIG } from '@/lib/pricing';
import type { PricingConfig } from '@/types';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { RatingBar } from '@/components/home/RatingBar';
import { StorySection } from '@/components/home/StorySection';
import { ExploreSection } from '@/components/home/ExploreSection';
import { AmenitiesSection } from '@/components/home/AmenitiesSection';
import { GearSection } from '@/components/home/GearSection';
import { ReviewsSection } from '@/components/home/ReviewsSection';
import { BookingWidget } from '@/components/home/BookingWidget';

async function fetchPricingConfig(): Promise<PricingConfig> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from('pricing_config').select('key, value');
    const map = Object.fromEntries(
      (data ?? []).map((r: { key: string; value: string }) => [r.key, parseFloat(r.value)])
    );
    return {
      ...DEFAULT_CONFIG,
      pricePerNight: map.price_per_night ?? DEFAULT_CONFIG.pricePerNight,
      cleaningFee: map.cleaning_fee ?? DEFAULT_CONFIG.cleaningFee,
      servicePct: (map.service_fee_pct ?? 14) / 100,
      taxRate: map.tax_rate ?? DEFAULT_CONFIG.taxRate,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function fetchBlockedDates(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('blocked_dates')
      .select('date')
      .gte('date', today);
    return (data ?? []).map((r: { date: string }) => r.date);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [pricingConfig, blockedDates] = await Promise.all([
    fetchPricingConfig(),
    fetchBlockedDates(),
  ]);

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <RatingBar />
        <StorySection />
        <ExploreSection />
        <AmenitiesSection />
        <GearSection />
        <ReviewsSection />
        <BookingWidget pricingConfig={pricingConfig} blockedDates={blockedDates} />
      </main>
      <Footer />
    </>
  );
}
