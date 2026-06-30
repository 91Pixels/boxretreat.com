import styles from './StorySection.module.css';

export function StorySection() {
  return (
    <section className={styles.section} id="story" aria-label="Our story">
      <p className="eyebrow">Our story</p>
      <span className={styles.ecoBadge}>
        <i className="bi bi-sun-fill" aria-hidden="true" />
        Solar powered · eco-friendly property
      </span>
      <h2 className={styles.title}>Built with our hands.<br />Made for your adventure.</h2>
      <p className={styles.body}>
        BoxRetreat started as a personal project — a dream to build something real, something that lets
        people experience Puerto Rico the way we love it. We converted a shipping container into a surf
        cabin that feels raw, honest, and close to everything that makes Luquillo special. Powered by
        the sun, built to respect the land, and designed for the kind of traveler who wants to be
        outside more than inside. No corporate feel. No unnecessary extras. Just the ocean, the
        rainforest, and a place to come back to after a long day in the water.
      </p>
    </section>
  );
}
