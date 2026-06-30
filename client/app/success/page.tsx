import { Suspense } from 'react';
import { stripe } from '@/lib/stripe';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import styles from './page.module.css';

interface Props {
  searchParams: { session_id?: string };
}

async function ConfirmationContent({ sessionId }: { sessionId: string }) {
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return (
      <div className={styles.card}>
        <div className={styles.iconError}>✕</div>
        <h1>Sesión no encontrada</h1>
        <p>No pudimos verificar tu reservación. Contacta al anfitrión si realizaste un pago.</p>
        <a href="/" className="btn-primary" style={{ marginTop: 24, display: 'inline-block' }}>Volver al inicio</a>
      </div>
    );
  }

  const meta = session.metadata ?? {};
  const email = session.customer_details?.email ?? '';
  const total = session.amount_total ? (session.amount_total / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '';

  if (session.payment_status !== 'paid') {
    return (
      <div className={styles.card}>
        <div className={styles.iconError}>✕</div>
        <h1>Pago pendiente</h1>
        <p>Tu pago no se completó. <a href="/">Intenta de nuevo</a>.</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.iconSuccess}>✓</div>
      <p className="eyebrow" style={{ marginBottom: 8 }}>RESERVACIÓN CONFIRMADA</p>
      <h1 className={styles.title}>¡Nos vemos en Luquillo!</h1>
      <p className={styles.sub}>
        Te enviamos un email de confirmación a <strong>{email}</strong> con todos los detalles.
      </p>

      {meta.bookingId && (
        <div className={styles.bookingId}>
          <span className="eyebrow">ID DE RESERVACIÓN</span>
          <strong>{meta.bookingId}</strong>
        </div>
      )}

      <div className={styles.details}>
        {meta.checkIn && (
          <div className={styles.detailRow}>
            <span>Check-in</span>
            <strong>{meta.checkIn}</strong>
          </div>
        )}
        {meta.checkOut && (
          <div className={styles.detailRow}>
            <span>Check-out</span>
            <strong>{meta.checkOut}</strong>
          </div>
        )}
        {meta.nights && (
          <div className={styles.detailRow}>
            <span>Noches</span>
            <strong>{meta.nights}</strong>
          </div>
        )}
        {meta.guests && (
          <div className={styles.detailRow}>
            <span>Huéspedes</span>
            <strong>{meta.guests}</strong>
          </div>
        )}
        {total && (
          <div className={`${styles.detailRow} ${styles.totalRow}`}>
            <span>Total pagado</span>
            <strong>{total}</strong>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <a href="/" className="btn-ghost">Volver al inicio</a>
        <a href="https://wa.me/17872345678" className="btn-primary" target="_blank" rel="noopener noreferrer">
          Contactar al anfitrión
        </a>
      </div>
    </div>
  );
}

export default function SuccessPage({ searchParams }: Props) {
  const sessionId = searchParams.session_id;

  return (
    <>
      <Nav />
      <main className={styles.wrap}>
        {sessionId ? (
          <Suspense fallback={<div className={styles.card}><p>Verificando pago...</p></div>}>
            <ConfirmationContent sessionId={sessionId} />
          </Suspense>
        ) : (
          <div className={styles.card}>
            <h1>Página de confirmación</h1>
            <p>Accede a esta página después de completar tu reservación.</p>
            <a href="/" className="btn-primary" style={{ marginTop: 24, display: 'inline-block' }}>Hacer una reservación</a>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
