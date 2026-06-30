'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import styles from './account.module.css';

interface Reservation {
  id: string;
  status: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total: number;
  created_at: string;
}

interface Props {
  user: { email?: string } | null;
  reservations: Reservation[];
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

export function AccountClient({ user, reservations }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError('Revisa tu email para confirmar tu cuenta.');
        setLoading(false);
        return;
      }
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  if (!user) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>CUENTA</p>
          <h1 className={styles.title}>Accede a tus reservaciones</h1>
          <p className={styles.sub}>Inicia sesión para ver el estado de tus reservaciones en BoxRetreat.</p>

          <div className={styles.modeTabs}>
            <button
              className={`${styles.modeTab} ${mode === 'login' ? styles.modeTabActive : ''}`}
              onClick={() => setMode('login')}
            >
              Iniciar sesión
            </button>
            <button
              className={`${styles.modeTab} ${mode === 'signup' ? styles.modeTabActive : ''}`}
              onClick={() => setMode('signup')}
            >
              Crear cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: 16, justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.dashboard}>
        <div className={styles.dashHeader}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>MI CUENTA</p>
            <h2>{user.email}</h2>
          </div>
          <button className="btn-ghost" onClick={logout}>Cerrar sesión</button>
        </div>

        <h3 style={{ marginBottom: 24 }}>Mis reservaciones</h3>

        {reservations.length === 0 ? (
          <div className={styles.empty}>
            <p>No tienes reservaciones todavía.</p>
            <a href="/#booking" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
              Hacer una reservación
            </a>
          </div>
        ) : (
          <div className={styles.resList}>
            {reservations.map(r => (
              <div key={r.id} className={styles.resCard}>
                <div className={styles.resTop}>
                  <span
                    className={`${styles.badge} ${
                      r.status === 'confirmed'
                        ? styles.badgeConfirmed
                        : r.status === 'cancelled'
                        ? styles.badgeCancelled
                        : styles.badgePending
                    }`}
                  >
                    {r.status === 'confirmed'
                      ? 'Confirmada'
                      : r.status === 'cancelled'
                      ? 'Cancelada'
                      : 'Pendiente'}
                  </span>
                  <span className={styles.resId}>{r.id}</span>
                </div>
                <div className={styles.resGrid}>
                  <div><span className="eyebrow">CHECK-IN</span><strong>{r.check_in}</strong></div>
                  <div><span className="eyebrow">CHECK-OUT</span><strong>{r.check_out}</strong></div>
                  <div><span className="eyebrow">NOCHES</span><strong>{r.nights}</strong></div>
                  <div><span className="eyebrow">HUÉSPEDES</span><strong>{r.guests}</strong></div>
                  <div><span className="eyebrow">TOTAL</span><strong>{fmt(r.total)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
