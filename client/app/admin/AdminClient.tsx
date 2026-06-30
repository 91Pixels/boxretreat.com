'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import type { ReservationRow, GearRentalRow } from './page';
import type { LockerInventoryItem } from '@/lib/lockers';
import styles from './admin.module.css';

function CountdownTimer({ deadline }: { deadline: string }) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('var(--gray-70)');

  useEffect(() => {
    function update() {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) { setLabel('OVERDUE'); setColor('#ef4444'); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setLabel(`${h}h ${m}m`);
      setColor(h < 3 ? '#ef4444' : h < 24 ? '#f59e0b' : '#10b981');
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [deadline]);

  return <span style={{ color, fontWeight: 600, fontSize: 13 }}>{label}</span>;
}

interface Props {
  user: { email?: string } | null;
  isAdmin: boolean;
  initialReservations: ReservationRow[];
  initialPricingConfig: Record<string, string>;
  initialBlockedDates: string[];
  initialGearRentals: GearRentalRow[];
  initialLockerInventory: LockerInventoryItem[];
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

export function AdminClient({ user, isAdmin, initialReservations, initialPricingConfig, initialBlockedDates, initialGearRentals, initialLockerInventory }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('reservations');

  // Pricing state
  const [priceNight, setPriceNight] = useState(initialPricingConfig.price_per_night ?? '185');
  const [priceCleaning, setPriceCleaning] = useState(initialPricingConfig.cleaning_fee ?? '75');
  const [priceService, setPriceService] = useState(initialPricingConfig.service_fee_pct ?? '14');
  const [priceSaving, setPriceSaving] = useState(false);
  const [priceSaved, setPriceSaved] = useState(false);

  // Blocked dates
  const [blockedDates, setBlockedDates] = useState<string[]>(initialBlockedDates);

  // Gear rentals
  const [releasingDeposit, setReleasingDeposit] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.refresh();
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : 'Error de autenticación');
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  async function savePricing() {
    setPriceSaving(true);
    await Promise.all([
      supabase.from('pricing_config').upsert({ key: 'price_per_night', value: priceNight }),
      supabase.from('pricing_config').upsert({ key: 'cleaning_fee', value: priceCleaning }),
      supabase.from('pricing_config').upsert({ key: 'service_fee_pct', value: priceService }),
    ]);
    setPriceSaving(false);
    setPriceSaved(true);
    setTimeout(() => setPriceSaved(false), 3000);
  }

  async function addBlockedDate() {
    if (!newDate || blockedDates.includes(newDate)) return;
    await supabase.from('blocked_dates').upsert({ date: newDate });
    setBlockedDates(prev => [...prev, newDate].sort());
    setNewDate('');
  }

  async function removeBlockedDate(date: string) {
    await supabase.from('blocked_dates').delete().eq('date', date);
    setBlockedDates(prev => prev.filter(d => d !== date));
  }

  async function releaseDeposit(rentalId: string) {
    setReleasingDeposit(rentalId);
    try {
      const res = await fetch('/api/gear-release-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rentalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Release failed');
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to release deposit');
    } finally {
      setReleasingDeposit(null);
    }
  }

  // Login gate
  if (!user) {
    return (
      <div className={styles.gate}>
        <div className={styles.gateBox}>
          <div className={styles.gateLogo}>BoxRetreat</div>
          <p className={styles.gateSub}>Owner Dashboard · Acceso privado</p>
          <form onSubmit={login} className={styles.gateForm}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email del propietario" required className={styles.gateInput} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" required className={styles.gateInput} />
            {authError && <p className={styles.gateError}>{authError}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%', padding: 16, justifyContent: 'center' }} disabled={authLoading}>
              {authLoading ? 'Cargando...' : '🔒 Entrar al Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Stats
  const confirmed = initialReservations.filter(r => r.status === 'confirmed');
  const totalRevenue = confirmed.reduce((s, r) => s + r.total, 0);
  const totalNights = confirmed.reduce((s, r) => s + r.nights, 0);

  const TABS = [
    { key: 'reservations', label: 'Reservaciones' },
    { key: 'pricing', label: 'Precios' },
    { key: 'blocked', label: 'Fechas Bloqueadas' },
    { key: 'gear', label: 'Gear Rentals' },
    { key: 'lockers', label: '🔒 Lockers' },
    { key: 'reports', label: 'Reportes P&L' },
  ];

  return (
    <div className={styles.wrap}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <span className={styles.topbarBrand}>BoxRetreat <span>Owner</span></span>
        <div className={styles.topbarRight}>
          <span className={styles.topbarUser}>{user.email}</span>
          <button className="btn-ghost" onClick={logout} style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff', padding: '8px 16px' }}>Salir</button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Stats */}
        <div className={styles.statsRow}>
          {[
            { label: 'Total Reservaciones', value: initialReservations.length },
            { label: 'Confirmadas', value: confirmed.length },
            { label: 'Revenue Total', value: fmt(totalRevenue) },
            { label: 'Noches Reservadas', value: totalNights },
          ].map(s => (
            <div key={s.label} className={styles.statCard}>
              <p className={styles.statLabel}>{s.label}</p>
              <p className={styles.statValue}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button key={t.key} className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Reservations */}
        {activeTab === 'reservations' && (
          <div className={styles.panel}>
            <h2 style={{ marginBottom: 24 }}>Todas las Reservaciones</h2>
            {initialReservations.length === 0 ? (
              <p style={{ color: 'var(--gray-70)' }}>No hay reservaciones todavía.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th><th>Huésped</th><th>Check-in</th><th>Check-out</th>
                      <th>Noches</th><th>Total</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialReservations.map(r => (
                      <tr key={r.id}>
                        <td><code style={{ fontSize: 11 }}>{r.id}</code></td>
                        <td>
                          <strong style={{ fontSize: 13 }}>{r.guest_name || '—'}</strong>
                          <br /><span style={{ fontSize: 12, color: 'var(--gray-70)' }}>{r.guest_email || ''}</span>
                        </td>
                        <td>{r.check_in}</td>
                        <td>{r.check_out}</td>
                        <td>{r.nights}</td>
                        <td><strong>{fmt(r.total)}</strong></td>
                        <td>
                          <span className={`${styles.badge} ${r.status === 'confirmed' ? styles.badgeGreen : r.status === 'cancelled' ? styles.badgeRed : styles.badgeGray}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pricing */}
        {activeTab === 'pricing' && (
          <div className={styles.panel}>
            <h2 style={{ marginBottom: 8 }}>Configuración de Precios</h2>
            <p style={{ color: 'var(--gray-70)', fontSize: 14, marginBottom: 24 }}>Los cambios aplican inmediatamente para nuevas reservaciones.</p>
            <div className={styles.pricingCard}>
              {[
                { label: 'Precio por noche', id: 'night', value: priceNight, setter: setPriceNight, suffix: '/ noche', prefix: '$' },
                { label: 'Tarifa de limpieza', id: 'clean', value: priceCleaning, setter: setPriceCleaning, suffix: 'por estadía', prefix: '$' },
                { label: 'Cargo por servicio', id: 'svc', value: priceService, setter: setPriceService, suffix: '% del subtotal', prefix: '' },
              ].map(row => (
                <div key={row.id} className={styles.priceRow}>
                  <label>{row.label} <span style={{ color: 'var(--gray-50)', fontWeight: 400 }}>{row.suffix}</span></label>
                  <div className={styles.priceInput}>
                    {row.prefix && <span>{row.prefix}</span>}
                    <input type="number" value={row.value} onChange={e => row.setter(e.target.value)} />
                    {!row.prefix && <span>%</span>}
                  </div>
                </div>
              ))}
              <button className="btn-primary" onClick={savePricing} disabled={priceSaving} style={{ marginTop: 8 }}>
                {priceSaving ? 'Guardando...' : priceSaved ? '✓ Guardado' : 'Guardar Precios'}
              </button>
            </div>
          </div>
        )}

        {/* Blocked Dates */}
        {activeTab === 'blocked' && (
          <div className={styles.panel}>
            <h2 style={{ marginBottom: 8 }}>Fechas Bloqueadas</h2>
            <p style={{ color: 'var(--gray-70)', fontSize: 14, marginBottom: 24 }}>Las fechas bloqueadas no pueden ser reservadas por huéspedes.</p>
            <div className={styles.blockedAdd}>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className={styles.dateInput} min={new Date().toISOString().split('T')[0]} />
              <button className="btn-primary" onClick={addBlockedDate} disabled={!newDate}>Bloquear fecha</button>
            </div>
            {blockedDates.length === 0 ? (
              <p style={{ color: 'var(--gray-70)', fontSize: 14 }}>No hay fechas bloqueadas.</p>
            ) : (
              <div className={styles.blockedTags}>
                {blockedDates.map(d => (
                  <div key={d} className={styles.blockedTag}>
                    <span>{d}</span>
                    <button onClick={() => removeBlockedDate(d)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gear Rentals */}
        {activeTab === 'gear' && (
          <div className={styles.panel}>
            <h2 style={{ marginBottom: 24 }}>Gear Rentals</h2>
            {initialGearRentals.length === 0 ? (
              <p style={{ color: 'var(--gray-70)' }}>No gear rentals yet.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th><th>Customer</th><th>Gear</th><th>Dates</th>
                      <th>Total</th><th>Code</th><th>Status</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialGearRentals.map(r => (
                      <tr key={r.id}>
                        <td><code style={{ fontSize: 11 }}>{r.rental_id}</code></td>
                        <td>
                          <strong style={{ fontSize: 13 }}>{r.customer_name}</strong>
                          <br /><span style={{ fontSize: 12, color: 'var(--gray-70)' }}>{r.customer_email}</span>
                        </td>
                        <td>{r.item_name}</td>
                        <td style={{ fontSize: 12 }}>{r.start_date}<br />{r.end_date}</td>
                        <td><strong>{fmt(r.grand_total_cents / 100)}</strong></td>
                        <td><code style={{ fontSize: 18, letterSpacing: '0.1em' }}>{r.locker_code}</code></td>
                        <td>
                          <span className={`${styles.badge} ${
                            r.status === 'completed' ? styles.badgeGreen :
                            styles.badgeGray
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          {r.status === 'returned' && (
                            <div>
                              {r.return_photo_urls.length > 0 && (
                                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                                  {r.return_photo_urls.slice(0, 3).map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={url}
                                        alt={`Return photo ${i + 1}`}
                                        style={{ width: 48, height: 48, objectFit: 'cover', border: '1px solid var(--br-mid)' }}
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                              <button
                                className="btn-primary"
                                style={{ padding: '8px 14px', fontSize: 12 }}
                                onClick={() => releaseDeposit(r.rental_id)}
                                disabled={releasingDeposit === r.rental_id}
                              >
                                {releasingDeposit === r.rental_id ? 'Processing...' : 'Release $20 deposit'}
                              </button>
                            </div>
                          )}
                          {r.status === 'completed' && (
                            <span style={{ fontSize: 12, color: 'var(--gray-70)' }}>
                              Deposit released<br />
                              {r.deposit_released_at ? new Date(r.deposit_released_at).toLocaleDateString() : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Locker Inventory */}
        {activeTab === 'lockers' && (
          <div className={styles.panel}>
            <h2 style={{ marginBottom: 24 }}>Locker Inventory</h2>
            {initialLockerInventory.length === 0 ? (
              <p style={{ color: 'var(--gray-70)' }}>No lockers configured. Run the SQL migration first.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Gear</th>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Customer</th>
                      <th>Pickup</th>
                      <th>Return Deadline</th>
                      <th>Time Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialLockerInventory.map(({ locker, status, rental }) => (
                      <tr key={locker.id}>
                        <td><strong>#{locker.locker_number}</strong></td>
                        <td style={{ textTransform: 'capitalize' }}>{locker.item_id.replace('-', ' ')}</td>
                        <td><code style={{ fontSize: 16, letterSpacing: '0.12em', fontWeight: 700 }}>{locker.access_code}</code></td>
                        <td>
                          <span className={`${styles.badge} ${
                            status === 'occupied' ? styles.badgeRed :
                            status === 'reserved' ? styles.badgeAmber :
                            styles.badgeGreen
                          }`}>
                            {status === 'occupied' ? '🔴 Occupied' : status === 'reserved' ? '🟡 Reserved' : '🟢 Available'}
                          </span>
                        </td>
                        <td>
                          {rental ? (
                            <strong style={{ fontSize: 13 }}>{rental.customer_name}</strong>
                          ) : <span style={{ color: 'var(--gray-50)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12 }}>{rental?.start_date ?? '—'}</td>
                        <td style={{ fontSize: 12 }}>
                          {rental?.return_deadline
                            ? new Date(rental.return_deadline).toLocaleString('en-US', {
                                timeZone: 'America/Puerto_Rico',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td>
                          {rental?.return_deadline
                            ? <CountdownTimer deadline={rental.return_deadline} />
                            : <span style={{ color: 'var(--gray-50)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* P&L Reports */}
        {activeTab === 'reports' && (
          <div className={styles.panel}>
            <h2 style={{ marginBottom: 8 }}>Reporte P&L</h2>
            <p style={{ color: 'var(--gray-70)', fontSize: 14, marginBottom: 32 }}>Resumen financiero de todas las reservaciones confirmadas.</p>
            <div className={styles.reportGrid}>
              <div className={styles.reportCard}>
                <p className="eyebrow" style={{ marginBottom: 8 }}>REVENUE BRUTO</p>
                <strong className={styles.reportVal}>{fmt(totalRevenue)}</strong>
                <p style={{ fontSize: 12, color: 'var(--gray-50)', marginTop: 4 }}>{confirmed.length} reservaciones confirmadas</p>
              </div>
              <div className={styles.reportCard}>
                <p className="eyebrow" style={{ marginBottom: 8 }}>NOCHES VENDIDAS</p>
                <strong className={styles.reportVal}>{totalNights}</strong>
                <p style={{ fontSize: 12, color: 'var(--gray-50)', marginTop: 4 }}>Revenue por noche promedio: {totalNights > 0 ? fmt(totalRevenue / totalNights) : '$0'}</p>
              </div>
              <div className={styles.reportCard}>
                <p className="eyebrow" style={{ marginBottom: 8 }}>TASA DE ÉXITO</p>
                <strong className={styles.reportVal}>{initialReservations.length > 0 ? Math.round(confirmed.length / initialReservations.length * 100) : 0}%</strong>
                <p style={{ fontSize: 12, color: 'var(--gray-50)', marginTop: 4 }}>Reservaciones confirmadas vs. total</p>
              </div>
            </div>
            <div className={styles.tableWrap} style={{ marginTop: 32 }}>
              <table className={styles.table}>
                <thead><tr><th>Mes</th><th>Reservaciones</th><th>Noches</th><th>Revenue</th></tr></thead>
                <tbody>
                  {Object.entries(
                    confirmed.reduce((acc: Record<string, { count: number; nights: number; revenue: number }>, r) => {
                      const month = r.check_in.slice(0, 7);
                      if (!acc[month]) acc[month] = { count: 0, nights: 0, revenue: 0 };
                      acc[month].count++;
                      acc[month].nights += r.nights;
                      acc[month].revenue += r.total;
                      return acc;
                    }, {})
                  ).sort((a, b) => b[0].localeCompare(a[0])).map(([month, data]) => (
                    <tr key={month}>
                      <td>{month}</td>
                      <td>{data.count}</td>
                      <td>{data.nights}</td>
                      <td><strong>{fmt(data.revenue)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
