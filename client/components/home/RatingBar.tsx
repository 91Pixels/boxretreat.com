import styles from './RatingBar.module.css';

export function RatingBar() {
  return (
    <div className={styles.bar} aria-label="Guest rating">
      <span className={styles.stars} aria-label="5 stars">★★★★★</span>
      <span className={styles.num}>4.97</span>
      <span className={styles.dot} aria-hidden="true">·</span>
      <span className={styles.count}>83 verified guest reviews</span>
    </div>
  );
}
