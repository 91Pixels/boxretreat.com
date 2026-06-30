'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from './page';
import styles from './shop.module.css';

interface CartItem { product: Product; qty: number; }

const CATEGORIES = [
  { key: 'all', label: 'Todo' },
  { key: 'surf', label: '🏄 Surf' },
  { key: 'water', label: '🤿 Agua' },
  { key: 'apparel', label: '👕 Ropa' },
];

const SERVICE_PCT = 0.14;

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });
}

export function ShopClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const [cat, setCat] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const filtered = cat === 'all' ? products : products.filter(p => p.category === cat);

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product, qty: 1 }];
    });
    setCartOpen(true);
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev
      .map(i => i.product.id === id ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    );
  }

  const subtotal = cart.reduce((s, i) => s + i.product.sell_price * i.qty, 0);
  const serviceFee = Math.round(subtotal * SERVICE_PCT);
  const total = subtotal + serviceFee;
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  async function checkout() {
    if (cart.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/shop-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart.map(i => ({ id: i.product.id, name: i.product.name, price: i.product.sell_price, qty: i.qty })), total }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      router.push(data.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Hero */}
      <section className={styles.hero}>
        <div className="container">
          <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>LUQUILLO · PUERTO RICO</p>
          <h1 className={styles.heroTitle}>Equipo para tu<br />día en el mar</h1>
          <p className={styles.heroSub}>Surf, snorkel y playa — entregado en BoxRetreat o pick-up en propiedad.</p>
        </div>
      </section>

      {/* Tabs */}
      <div className={styles.tabsBar}>
        <div className="container">
          <div className={styles.tabs}>
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                className={`${styles.tab} ${cat === c.key ? styles.tabActive : ''}`}
                onClick={() => setCat(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <section className="section">
        <div className="container">
          <div className={styles.grid}>
            {filtered.map(p => (
              <div key={p.id} className={styles.card}>
                <div className={styles.cardImg}>
                  <span className={styles.categoryTag}>{p.category}</span>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.productName}>{p.name}</h3>
                  <div className={styles.cardFooter}>
                    <span className={styles.price}>{fmt(p.sell_price)}</span>
                    <button
                      className="btn-primary"
                      onClick={() => addToCart(p)}
                      disabled={p.stock === 0}
                      style={{ padding: '10px 20px', fontSize: 13 }}
                    >
                      {p.stock === 0 ? 'Sin stock' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Info strip */}
      <section className={styles.infoStrip}>
        <div className="container">
          <div className={styles.infoGrid}>
            {[
              { icon: '🚚', title: 'Entrega gratis', sub: 'Para huéspedes de BoxRetreat' },
              { icon: '↩️', title: 'Cancelación gratis', sub: 'Hasta 24h antes del pick-up' },
              { icon: '🛡️', title: 'Daño menor cubierto', sub: 'Daño mayor se factura al costo' },
              { icon: '✓', title: 'Limpio e inspeccionado', sub: 'Antes de cada renta' },
            ].map(item => (
              <div key={item.title} className={styles.infoItem}>
                <span className={styles.infoIcon}>{item.icon}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cart button */}
      {itemCount > 0 && (
        <button className={styles.cartFab} onClick={() => setCartOpen(true)} aria-label="Abrir carrito">
          🛒 <span className={styles.cartBadge}>{itemCount}</span>
        </button>
      )}

      {/* Cart sidebar */}
      {cartOpen && <div className={styles.overlay} onClick={() => setCartOpen(false)} />}
      <div className={`${styles.sidebar} ${cartOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <h3>Tu carrito</h3>
          <button onClick={() => setCartOpen(false)} className={styles.closeBtn}>✕</button>
        </div>
        <div className={styles.sidebarBody}>
          {cart.length === 0 ? (
            <p className={styles.emptyCart}>Tu carrito está vacío.</p>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className={styles.cartItem}>
                <div className={styles.cartItemInfo}>
                  <strong>{item.product.name}</strong>
                  <span>{fmt(item.product.sell_price)} c/u</span>
                </div>
                <div className={styles.cartQty}>
                  <button onClick={() => updateQty(item.product.id, -1)}>−</button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, 1)}>+</button>
                </div>
              </div>
            ))
          )}
        </div>
        {cart.length > 0 && (
          <div className={styles.sidebarFooter}>
            <div className={styles.summaryRow}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className={styles.summaryRow}><span>Cargo servicio (14%)</span><span>{fmt(serviceFee)}</span></div>
            <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Total</span><span>{fmt(total)}</span></div>
            {error && <p style={{ color: '#cc0000', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <button className="btn-primary" style={{ width: '100%', padding: 16, marginTop: 16, justifyContent: 'center' }} onClick={checkout} disabled={loading}>
              {loading ? 'Procesando...' : 'Checkout →'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
