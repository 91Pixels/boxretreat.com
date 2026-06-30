import styles from './LocationSection.module.css';

const DISTANCES = [
  { place: 'Playa de Luquillo', dist: '5 min', icon: '🏄' },
  { place: 'El Yunque', dist: '15 min', icon: '🌿' },
  { place: 'Kioscos de Luquillo', dist: '3 min', icon: '🍽️' },
  { place: 'Aeropuerto SJU', dist: '45 min', icon: '✈️' },
  { place: 'Old San Juan', dist: '55 min', icon: '🏙️' },
  { place: 'La Pared Surf Spot', dist: '8 min', icon: '🌊' },
];

export function LocationSection() {
  return (
    <section className={`section ${styles.section}`} id="location">
      <div className="container">
        <p className="eyebrow" style={{ marginBottom: 12 }}>UBICACIÓN</p>
        <h2 style={{ marginBottom: 40 }}>Luquillo, Puerto Rico</h2>
        <div className={styles.grid}>
          <div className={styles.map}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15092.45!2d-65.72!3d18.37!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8c03695ae5d6c4b5%3A0x6b1e0e73d0c92b8a!2sLuquillo%2C+Puerto+Rico!5e0!3m2!1sen!2sus!4v1234567890"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="BoxRetreat location in Luquillo, PR"
            />
          </div>
          <div className={styles.distances}>
            {DISTANCES.map(({ place, dist, icon }) => (
              <div key={place} className={styles.distRow}>
                <span className={styles.distIcon}>{icon}</span>
                <span className={styles.distPlace}>{place}</span>
                <span className={styles.distTime}>{dist}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
