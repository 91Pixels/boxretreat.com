export interface PricingConfig {
  pricePerNight: number;
  cleaningFee: number;
  servicePct: number;   // e.g. 0.14
  taxRate: number;      // e.g. 0.115
  minNights: number;
  maxNights: number;
  maxGuests: number;
}

export interface PricingResult {
  nights: number;
  pricePerNight: number;
  subtotal: number;
  cleaningFee: number;
  serviceFee: number;
  taxes: number;
  total: number;
}

export interface BookingState {
  checkIn: string | null;       // ISO date string 'YYYY-MM-DD'
  checkOut: string | null;
  guests: number;
  pricing: PricingResult | null;
  pricingConfig: PricingConfig | null;
  blockedDates: string[];       // ISO date strings
}

export interface Reservation {
  id: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  guestName: string;
  guestEmail: string;
  pricing: PricingResult;
  status: 'confirmed' | 'cancelled' | 'pending';
  stripeSessionId?: string;
}
