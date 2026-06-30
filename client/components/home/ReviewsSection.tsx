import styles from './ReviewsSection.module.css';

const REVIEWS = [
  {
    initials: 'ST',
    text: '"Woke up to the sound of waves every morning. The cabin is exactly what it looks like — raw, real, and perfectly located. Surfed La Pared every day, then came back and grilled on the deck. Perfect week."',
    author: 'Sarah T. · stayed June 2025 · 5 nights',
  },
  {
    initials: 'JR',
    text: '"We rented the surfboards and the snorkel gear — worth every dollar. The team made everything seamless. Luquillo is incredible and BoxRetreat is the best base for it."',
    author: 'James R. · stayed March 2025 · 3 nights',
  },
  {
    initials: 'MK',
    text: '"Solo trip. Best decision I made. Quiet enough to decompress, wild enough to feel alive. The outdoor shower after a surf session is a vibe. I\'ll be back."',
    author: 'Marcus K. · stayed January 2025 · 4 nights',
  },
];

export function ReviewsSection() {
  return (
    <section className={styles.section} id="reviews" aria-label="Guest reviews">
      <div className={styles.inner}>
        <p className="eyebrow">Reviews</p>
        <h2 className={styles.title}>From guests who stayed here.</h2>

        <div className={styles.score}>
          <span className={styles.scoreBig}>4.97</span>
          <div>
            <p className={styles.scoreStars} aria-label="5 stars">★★★★★</p>
            <p className={styles.scoreCount}>83 verified guest reviews</p>
          </div>
        </div>

        <div className={styles.cards}>
          {REVIEWS.map((r) => (
            <article key={r.initials} className={styles.card}>
              <p className={styles.cardStars} aria-label="5 stars">★★★★★</p>
              <p className={styles.cardText}>{r.text}</p>
              <div className={styles.meta}>
                <div className={styles.avatar} aria-hidden="true">{r.initials}</div>
                <span className={styles.author}>{r.author}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
