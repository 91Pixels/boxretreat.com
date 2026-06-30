/* eslint-disable @next/next/no-img-element */
import styles from './PropertySection.module.css';

const IMAGES = [
  { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop', alt: 'Container exterior' },
  { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop', alt: 'Living space' },
  { url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&h=600&fit=crop', alt: 'Bedroom' },
  { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop', alt: 'Deck at sunset' },
  { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop', alt: 'Kitchen' },
];

const SPECS = [
  { label: 'TAMAÑO', value: '400 sq ft' },
  { label: 'HUÉSPEDES', value: 'Hasta 4' },
  { label: 'HABITACIONES', value: '1 Cuarto' },
  { label: 'BAÑOS', value: '1 Baño' },
  { label: 'CHECK-IN', value: '3:00 PM' },
  { label: 'CHECK-OUT', value: '11:00 AM' },
];

export function PropertySection() {
  return (
    <section className={`section ${styles.section}`} id="property">
      <div className="container">
        <div className={styles.grid}>
          {/* Text */}
          <div className={styles.text}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>LA CABAÑA</p>
            <h2 style={{ marginBottom: 20 }}>Rústico por diseño,<br />orgánico por naturaleza</h2>
            <p style={{ marginBottom: 16 }}>
              400 sq ft de esencia surfera auténtica en Luquillo, Puerto Rico.
              Este container reciclado fue transformado en un refugio costero acogedor,
              orgánico y sin pretensiones — diseñado para quienes vienen a surfear,
              explorar El Yunque y desconectarse del ruido.
            </p>
            <p style={{ marginBottom: 32 }}>
              Ventanas de piso a techo enmarcan palmas y montañas. Despierta al
              coquí, toma café en la terraza y llega a la playa en minutos.
            </p>
            <div className={styles.specs}>
              {SPECS.map(({ label, value }) => (
                <div key={label} className={styles.spec}>
                  <span className="eyebrow">{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Gallery grid */}
          <div className={styles.gallery}>
            <div className={styles.galleryMain}>
              <img src={IMAGES[0].url} alt={IMAGES[0].alt} />
            </div>
            <div className={styles.gallerySide}>
              {IMAGES.slice(1, 5).map((img) => (
                <img key={img.url} src={img.url} alt={img.alt} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
