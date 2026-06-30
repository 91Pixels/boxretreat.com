'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DayPicker, DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { GEAR_ITEMS, GearItem } from '@/lib/gear';
import { daysBetween } from '@/lib/locker';
import styles from './gear.module.css';

const DEPOSIT = 20;

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

export function GearRentalClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselect = searchParams.get('item') ?? '';

  const [selected, setSelected] = useState<GearItem | null>(
    () => GEAR_ITEMS.find(g => g.id === preselect) ?? null
  );
  const [range, setRange] = useState<DateRange | undefined>();
  const [showCal, setShowCal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState<{ configured: boolean; available: boolean; count: number } | null>(null);
  const [checkingAvail, setCheckingAvail] = useState(false);

  useEffect(() => {
    if (selected) setShowCal(true);
  }, [selected]);

  const startDate = range?.from ? toISO(range.from) : null;
  const endDate = range?.to ? toISO(range.to) : null;

  useEffect(() => {
    if (!selected || !startDate || !endDate) { setAvailability(null); return; }
    setCheckingAvail(true);
    fetch(`/api/gear-availability?itemId=${selected.id}&startDate=${startDate}&endDate=${endDate}`)
      .then(r => r.json())
      .then(data => setAvailability(data))
      .catch(() => setAvailability(null))
      .finally(() => setCheckingAvail(false));
  }, [selected, startDate, endDate]);
  const days = startDate && endDate ? daysBetween(startDate, endDate) : 0;
  const rentalTotal = selected ? days * selected.pricePerDay : 0;
  const grandTotal = rentalTotal + (days > 0 ? DEPOSIT : 0);

  const canCheckout = !!selected && days > 0 && name.trim() !== '' && email.trim() !== '';

  async function handleCheckout() {
    if (!canCheckout || !selected || !startDate || !endDate) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gear-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selected.id,
          startDate,
          endDate,
          customerName: name.trim(),
          customerEmail: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      router.push(data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const today = new Date();

  return (
    <>
      <section className={styles.hero}>
        <div className="container">
          <p className="eyebrow" style={{ color: 'var(--br-mid)', marginBottom: 12 }}>
            LUQUILLO · PUERTO RICO
          </p>
          <h1 className={styles.heroTitle}>Gear Rentals</h1>
          <p className={styles.heroSub}>
            Select your gear, pick your dates, and get a locker code after checkout.
            $20 refundable deposit — returned within 48h after inspection.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.layout}>
            <div>
              <p className="eyebrow" style={{ marginBottom: 24 }}>CHOOSE YOUR GEAR</p>
              <div className={styles.grid}>
                {GEAR_ITEMS.map(item => (
                  <div
                    key={item.id}
                    className={`${styles.card} ${selected?.id === item.id ? styles.selected : ''}`}
                  >
                    <div className={styles.cardBody}>
                      <div className={styles.cardIcon}>
                        <i className={item.icon} />
                      </div>
                      <h3 className={styles.cardName}>{item.name}</h3>
                      <p className={styles.cardDesc}>{item.description}</p>
                      <div>
                        <span className={styles.cardPrice}>{fmt(item.pricePerDay)}</span>
                        <span className={styles.cardPriceSub}>/ day</span>
                      </div>
                      <button
                        className={`btn-primary ${styles.selectBtn}`}
                        onClick={() => setSelected(item)}
                      >
                        {selected?.id === item.id ? (
                          <><i className="bi-check-lg" style={{ marginRight: 6 }} />Selected</>
                        ) : 'Select'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.bookingPanel}>
              <p className={styles.panelTitle}>
                {selected ? `Reserve · ${selected.name}` : 'Select gear to continue'}
              </p>

              {selected && (
                <>
                  <div className={styles.dateGridRow}>
                    <div
                      className={styles.dateGrid}
                      onClick={() => setShowCal(v => !v)}
                    >
                      <div className={styles.dateBox}>
                        <p className={styles.dateLabel}>START DATE</p>
                        <p className={styles.dateVal}>{startDate ?? '— select —'}</p>
                      </div>
                      <div className={styles.dateBox}>
                        <p className={styles.dateLabel}>END DATE</p>
                        <p className={styles.dateVal}>{endDate ?? '— select —'}</p>
                      </div>
                    </div>
                    {range?.from && (
                      <button
                        className={styles.clearDates}
                        onClick={(e) => { e.stopPropagation(); setRange(undefined); setAvailability(null); setShowCal(true); }}
                        title="Clear dates"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {showCal && (
                    <div className={styles.calendarWrap}>
                      <DayPicker
                        mode="range"
                        selected={range}
                        onSelect={setRange}
                        disabled={{ before: today }}
                        numberOfMonths={1}
                      />
                    </div>
                  )}

                  <div className={styles.field}>
                    <p className={styles.fieldLabel}>YOUR NAME</p>
                    <input
                      className={styles.input}
                      type="text"
                      placeholder="First and last name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div className={styles.field}>
                    <p className={styles.fieldLabel}>EMAIL</p>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>

                  {days > 0 && (checkingAvail || (availability?.configured)) && (
                    <div
                      className={styles.availBadge}
                      data-avail={checkingAvail ? 'checking' : availability?.available ? 'yes' : 'no'}
                    >
                      {checkingAvail
                        ? '⏳ Checking availability…'
                        : availability?.available
                        ? `✅ ${availability.count} locker${availability.count !== 1 ? 's' : ''} available`
                        : '❌ No lockers available for these dates'}
                    </div>
                  )}

                  {days > 0 && (
                    <div className={styles.summary}>
                      <div className={styles.summaryRow}>
                        <span>{fmt(selected.pricePerDay)} × {days} {days === 1 ? 'day' : 'days'}</span>
                        <span>{fmt(rentalTotal)}</span>
                      </div>
                      <div className={styles.summaryRow}>
                        <span>Security deposit (refundable)</span>
                        <span>{fmt(DEPOSIT)}</span>
                      </div>
                      <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                        <span>Total charged today</span>
                        <span>{fmt(grandTotal)}</span>
                      </div>
                    </div>
                  )}

                  {error && <p className={styles.error}>{error}</p>}

                  <button
                    className={`btn-primary ${styles.reserveBtn}`}
                    onClick={handleCheckout}
                    disabled={!canCheckout || loading}
                  >
                    {loading ? 'Processing...' : `Reserve → ${canCheckout ? fmt(grandTotal) : ''}`}
                  </button>
                  <p className={styles.note}>
                    $20 deposit returned within 48h after gear inspection.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
