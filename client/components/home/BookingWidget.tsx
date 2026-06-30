'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useBookingStore } from '@/store/bookingStore';
import type { PricingConfig } from '@/types';
import { PricingBreakdown } from './PricingBreakdown';
import styles from './BookingWidget.module.css';
import { nightsBetween } from '@/lib/pricing';

interface Props {
  pricingConfig: PricingConfig;
  blockedDates: string[];
}

export function BookingWidget({ pricingConfig, blockedDates }: Props) {
  const router = useRouter();
  const {
    checkIn, checkOut, guests, pricing,
    setDates, setGuests, setPricingConfig, setBlockedDates,
  } = useBookingStore();

  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Seed store with server-fetched config on first render
  useEffect(() => {
    setPricingConfig(pricingConfig);
    setBlockedDates(blockedDates);
  }, [pricingConfig, blockedDates, setPricingConfig, setBlockedDates]);

  const disabledDays = blockedDates.map((d) => new Date(d + 'T12:00:00'));
  const selected = checkIn && checkOut
    ? { from: new Date(checkIn + 'T12:00:00'), to: new Date(checkOut + 'T12:00:00') }
    : undefined;

  function handleSelect(range: { from?: Date; to?: Date } | undefined) {
    if (!range?.from) return;
    const ci = range.from.toISOString().split('T')[0];
    const co = range.to ? range.to.toISOString().split('T')[0] : ci;
    if (ci !== co) {
      setDates(ci, co);
      setShowCalendar(false);
    }
  }

  async function handleReserve() {
    if (!checkIn || !checkOut || !pricing) {
      setError('Selecciona las fechas para continuar.');
      return;
    }
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < pricingConfig.minNights) {
      setError(`Mínimo ${pricingConfig.minNights} noches.`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkIn, checkOut, guests, pricing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando sesión');
      router.push(data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  const nightsCount = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  return (
    <section className={styles.section} id="book" aria-label="Book your stay">
      <div className={styles.inner}>
        <div className={styles.priceRow}>
          <span className={styles.price}>${pricingConfig.pricePerNight}</span>
          <span className={styles.perNight}> / night</span>
        </div>

        <div className={styles.dateGrid} onClick={() => setShowCalendar(!showCalendar)}>
          <div className={styles.dateBox}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>Check-in</p>
            <p className={styles.dateVal}>{checkIn || 'Add date'}</p>
          </div>
          <div className={styles.dateDivider} />
          <div className={styles.dateBox}>
            <p className="eyebrow" style={{ marginBottom: 2 }}>Check-out</p>
            <p className={styles.dateVal}>{checkOut || 'Add date'}</p>
          </div>
        </div>

        {showCalendar && (
          <div className={styles.calendarWrap}>
            <DayPicker
              mode="range"
              selected={selected}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onSelect={handleSelect as any}
              disabled={[{ before: new Date() }, ...disabledDays]}
              numberOfMonths={1}
            />
          </div>
        )}

        <div className={styles.guestRow}>
          <p className={styles.guestLabel}>Guests</p>
          <div className={styles.counter}>
            <button onClick={() => setGuests(Math.max(1, guests - 1))} aria-label="Remove guest">−</button>
            <span>{guests}</span>
            <button onClick={() => setGuests(Math.min(pricingConfig.maxGuests, guests + 1))} aria-label="Add guest">+</button>
          </div>
        </div>
        <p className={styles.guestDisplay}>{guests} {guests === 1 ? 'guest' : 'guests'}</p>

        {pricing && nightsCount >= 2 && (
          <PricingBreakdown pricing={pricing} />
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={`btn-primary ${styles.reserveBtn}`}
          onClick={handleReserve}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Reserve'}
        </button>

        <p className={styles.noCharge}>You won&apos;t be charged yet</p>
      </div>
    </section>
  );
}
