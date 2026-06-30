import { describe, it, expect } from 'vitest';
import { GEAR_ITEMS, getGearItem } from '../lib/gear';
import { daysBetween } from '../lib/locker';

describe('GEAR_ITEMS', () => {
  it('has 6 items', () => {
    expect(GEAR_ITEMS).toHaveLength(6);
  });

  it('each item has required fields', () => {
    for (const item of GEAR_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.pricePerDay).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});

describe('getGearItem', () => {
  it('returns item by id', () => {
    const item = getGearItem('surfboard');
    expect(item?.name).toBe('Surfboard');
  });

  it('returns undefined for unknown id', () => {
    expect(getGearItem('unknown-xyz')).toBeUndefined();
  });
});


describe('daysBetween', () => {
  it('returns 3 for a 3-day rental', () => {
    expect(daysBetween('2026-07-01', '2026-07-04')).toBe(3);
  });

  it('returns 1 for same-day to next-day', () => {
    expect(daysBetween('2026-07-01', '2026-07-02')).toBe(1);
  });

  it('returns 0 for same dates', () => {
    expect(daysBetween('2026-07-01', '2026-07-01')).toBe(0);
  });
});
