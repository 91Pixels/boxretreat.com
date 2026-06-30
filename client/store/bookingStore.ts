import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BookingState, PricingConfig, PricingResult } from '@/types';
import { calculatePricing, nightsBetween } from '@/lib/pricing';

interface BookingActions {
  setDates: (checkIn: string, checkOut: string) => void;
  setGuests: (guests: number) => void;
  setPricingConfig: (config: PricingConfig) => void;
  setBlockedDates: (dates: string[]) => void;
  reset: () => void;
}

const initialState: BookingState = {
  checkIn: null,
  checkOut: null,
  guests: 2,
  pricing: null,
  pricingConfig: null,
  blockedDates: [],
};

export const useBookingStore = create<BookingState & BookingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setDates: (checkIn, checkOut) => {
        const { pricingConfig } = get();
        let pricing: PricingResult | null = null;
        if (pricingConfig && checkIn && checkOut) {
          const nights = nightsBetween(checkIn, checkOut);
          pricing = calculatePricing(nights, pricingConfig);
        }
        set({ checkIn, checkOut, pricing });
      },

      setGuests: (guests) => set({ guests }),

      setPricingConfig: (config) => set({ pricingConfig: config }),

      setBlockedDates: (dates) => set({ blockedDates: dates }),

      reset: () => set(initialState),
    }),
    {
      name: 'br-booking',
      partialize: (state) => ({
        checkIn: state.checkIn,
        checkOut: state.checkOut,
        guests: state.guests,
      }),
    }
  )
);
