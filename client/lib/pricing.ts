import type { PricingConfig, PricingResult } from '@/types';

export const DEFAULT_CONFIG: PricingConfig = {
  pricePerNight: 185,
  cleaningFee: 75,
  servicePct: 0.14,
  taxRate: 0.115,
  minNights: 2,
  maxNights: 30,
  maxGuests: 4,
};

export function nightsBetween(checkIn: string, checkOut: string): number {
  const s = new Date(checkIn + 'T12:00:00');
  const e = new Date(checkOut + 'T12:00:00');
  return Math.round((e.getTime() - s.getTime()) / 86_400_000);
}

export function calculatePricing(
  nights: number,
  config: PricingConfig
): PricingResult | null {
  if (!nights || nights <= 0) return null;
  const subtotal    = nights * config.pricePerNight;
  const cleaningFee = config.cleaningFee;
  const serviceFee  = Math.round(subtotal * config.servicePct);
  const taxes       = Math.round((subtotal + cleaningFee + serviceFee) * config.taxRate);
  const total       = subtotal + cleaningFee + serviceFee + taxes;
  return {
    nights,
    pricePerNight: config.pricePerNight,
    subtotal,
    cleaningFee,
    serviceFee,
    taxes,
    total,
  };
}
