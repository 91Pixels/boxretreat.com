import { describe, it, expect } from 'vitest';
import { calculatePricing, nightsBetween, DEFAULT_CONFIG } from '../lib/pricing';

describe('nightsBetween', () => {
  it('returns 3 for a 3-night stay', () => {
    expect(nightsBetween('2025-07-01', '2025-07-04')).toBe(3);
  });

  it('returns 1 for a 1-night stay', () => {
    expect(nightsBetween('2025-07-01', '2025-07-02')).toBe(1);
  });

  it('returns 0 for same-day', () => {
    expect(nightsBetween('2025-07-01', '2025-07-01')).toBe(0);
  });
});

describe('calculatePricing', () => {
  const config = DEFAULT_CONFIG; // pricePerNight=185, cleaning=75, svc=14%, tax=11.5%

  it('calculates a 3-night stay correctly', () => {
    const result = calculatePricing(3, config);
    // subtotal: 3 × 185 = 555
    // cleaningFee: 75
    // serviceFee: round(555 × 0.14) = 78 (actually 77.7 → rounds to 78)
    // taxes: round((555 + 75 + 78) × 0.115) = round(708 × 0.115) = round(81.42) = 81
    // total: 555 + 75 + 78 + 81 = 789
    expect(result?.nights).toBe(3);
    expect(result?.pricePerNight).toBe(185);
    expect(result?.subtotal).toBe(555);
    expect(result?.cleaningFee).toBe(75);
    expect(result?.serviceFee).toBe(78);
    expect(result?.taxes).toBe(81);
    expect(result?.total).toBe(789);
  });

  it('calculates a 7-night stay correctly', () => {
    const result = calculatePricing(7, config);
    // subtotal: 7 × 185 = 1295
    // serviceFee: round(1295 × 0.14) = round(181.3) = 181
    // taxes: round((1295 + 75 + 181) × 0.115) = round(1551 × 0.115) = round(178.365) = 178
    // total: 1295 + 75 + 181 + 178 = 1729
    expect(result?.subtotal).toBe(1295);
    expect(result?.serviceFee).toBe(181);
    expect(result?.taxes).toBe(178);
    expect(result?.total).toBe(1729);
  });

  it('returns null for 0 nights', () => {
    expect(calculatePricing(0, config)).toBeNull();
  });

  it('returns null for negative nights', () => {
    expect(calculatePricing(-1, config)).toBeNull();
  });

  it('respects custom pricePerNight override', () => {
    const customConfig = { ...config, pricePerNight: 200 };
    const result = calculatePricing(2, customConfig);
    expect(result?.subtotal).toBe(400);
  });
});
