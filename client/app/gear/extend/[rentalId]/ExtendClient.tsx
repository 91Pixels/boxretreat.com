'use client';
import { useState } from 'react';
import styles from './extend.module.css';

interface Props {
  rentalId: string;
  itemName: string;
  currentEndDate: string;
  dailyRateCents: number;
}

export function ExtendClient({ rentalId, itemName, currentEndDate, dailyRateCents }: Props) {
  const [days, setDays] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const totalCents = days * dailyRateCents;
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

  async function handleExtend() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gear-extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalId, days, discountAmountCents: 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extension failed');
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.icon}>✉️</div>
          <h1 className={styles.title}>Payment Link Sent!</h1>
          <p className={styles.sub}>
            We&apos;ve emailed you a payment link for your {days}-day extension.
            Complete payment to confirm the extension.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Extend Your Rental</h1>
        <p className={styles.sub}>
          <strong>{itemName}</strong> · Current return: <strong>{currentEndDate}</strong> at 3:00 PM
        </p>

        <div className={styles.field}>
          <label className={styles.label}>Additional Days</label>
          <div className={styles.stepper}>
            <button className={styles.stepBtn} onClick={() => setDays(d => Math.max(1, d - 1))}>−</button>
            <span className={styles.stepVal}>{days}</span>
            <button className={styles.stepBtn} onClick={() => setDays(d => d + 1)}>+</button>
          </div>
        </div>

        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>{fmt(dailyRateCents)} × {days} {days === 1 ? 'day' : 'days'}</span>
            <span>{fmt(totalCents)}</span>
          </div>
          <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
            <span>Total</span>
            <span>{fmt(totalCents)}</span>
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.btn} onClick={handleExtend} disabled={loading}>
          {loading ? 'Processing…' : `Request Extension · ${fmt(totalCents)}`}
        </button>
        <p className={styles.note}>A payment link will be sent to your email.</p>
      </div>
    </main>
  );
}
