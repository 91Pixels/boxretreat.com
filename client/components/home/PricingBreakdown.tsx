import type { PricingResult } from '@/types';
import styles from './PricingBreakdown.module.css';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

interface Props {
  pricing: PricingResult;
}

export function PricingBreakdown({ pricing }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span>{fmt(pricing.pricePerNight)} × {pricing.nights} {pricing.nights === 1 ? 'noche' : 'noches'}</span>
        <span>{fmt(pricing.subtotal)}</span>
      </div>
      <div className={styles.row}>
        <span>Limpieza</span>
        <span>{fmt(pricing.cleaningFee)}</span>
      </div>
      <div className={styles.row}>
        <span>Cargo por servicio</span>
        <span>{fmt(pricing.serviceFee)}</span>
      </div>
      <div className={styles.row}>
        <span>Impuestos (11.5%)</span>
        <span>{fmt(pricing.taxes)}</span>
      </div>
      <div className={`${styles.row} ${styles.total}`}>
        <span>Total</span>
        <span>{fmt(pricing.total)}</span>
      </div>
    </div>
  );
}
