'use client';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.hero} id="hero" aria-label="BoxRetreat hero">
      <img
        className={styles.img}
        src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=85&auto=format"
        alt="BoxRetreat surf cabin exterior at Luquillo, Puerto Rico"
        loading="eager"
      />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.eyebrow}>
          <i className="bi bi-geo-alt" aria-hidden="true" /> Luquillo · Puerto Rico
        </p>
        <h1 className={styles.headline}>BoxRetreat<br />Surf Cabin</h1>
      </div>
    </section>
  );
}
