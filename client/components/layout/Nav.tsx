'use client';
import { useState, useEffect } from 'react';
import styles from './Nav.module.css';

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`} role="navigation" aria-label="Main navigation">
      <div className={styles.inner}>
        <a href="/" className={styles.logo} aria-label="BoxRetreat home">
          Box<span>Retreat</span>
        </a>

        <button
          className={styles.hamburger}
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          aria-expanded={open}
        >
          <span /><span /><span />
        </button>

        <div className={`${styles.links} ${open ? styles.linksOpen : ''}`}>
          <a href="#explore"    onClick={() => setOpen(false)}>Explore</a>
          <a href="#amenities"  onClick={() => setOpen(false)}>Amenities</a>
          <a href="#gear"       onClick={() => setOpen(false)}>Gear</a>
          <a href="#book"       onClick={() => setOpen(false)} className={styles.ctaLink}>Book now</a>
        </div>
      </div>
    </nav>
  );
}
