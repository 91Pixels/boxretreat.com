import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.social} aria-label="Social media">
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <i className="bi bi-instagram" />
        </a>
        <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
          <i className="bi bi-tiktok" />
        </a>
        <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <i className="bi bi-facebook" />
        </a>
      </div>
      <p className={styles.made}>Made in Puerto Rico</p>
      <a href="/admin" className={styles.admin}>
        <i className="bi bi-lock" aria-hidden="true" />
        Administrative Portal
      </a>
    </footer>
  );
}
