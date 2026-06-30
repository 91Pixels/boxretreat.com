import styles from './AmenitiesSection.module.css';

const AMENITIES = [
  { icon: 'bi-wind',           label: 'Air conditioning' },
  { icon: 'bi-wifi',           label: 'High-speed Wi-Fi' },
  { icon: 'bi-fire',           label: 'BBQ deck' },
  { icon: 'bi-egg-fried',      label: 'Full kitchen' },
  { icon: 'bi-droplet-fill',   label: 'Outdoor shower' },
  { icon: 'bi-p-square-fill',  label: 'Parking' },
  { icon: 'bi-door-open-fill', label: 'Self check-in' },
  { icon: 'bi-moon-stars-fill',label: 'Private deck' },
];

export function AmenitiesSection() {
  return (
    <section className={styles.section} id="amenities" aria-label="Amenities">
      <div className={styles.inner}>
        <p className="eyebrow">Amenities</p>
        <h2 className={styles.title}>Everything you need, nothing you don&apos;t.</h2>
        <span className={styles.ecoBadge}>
          <i className="bi bi-sun-fill" aria-hidden="true" />
          Solar powered · eco-friendly
        </span>
        <ul className={styles.grid} role="list">
          {AMENITIES.map(({ icon, label }) => (
            <li key={label} className={styles.item}>
              <i className={`bi ${icon}`} aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
