/* eslint-disable @next/next/no-img-element */
import styles from './HostSection.module.css';

export function HostSection() {
  return (
    <section className={`section ${styles.section}`} id="host">
      <div className="container">
        <div className={styles.grid}>
          <div className={styles.profile}>
            <img
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face"
              alt="Michael, host"
              className={styles.avatar}
            />
            <div>
              <h3>Anfitrión: Michael</h3>
              <p className={styles.since}>Superhost desde marzo 2022</p>
            </div>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}><strong>83</strong><span>Reseñas</span></div>
            <div className={styles.stat}><strong>4.97</strong><span>Calificación</span></div>
            <div className={styles.stat}><strong>99%</strong><span>Respuesta</span></div>
          </div>
          <p className={styles.bio}>
            Hola, soy Michael, puertorriqueño de corazón. BoxRetreat es mi proyecto de pasión —
            un espacio diseñado para que experimentes la belleza auténtica de Luquillo:
            el surf, El Yunque, la gastronomía local y la tranquilidad del mar.
            Siempre disponible para recomendaciones y lo que necesites.
          </p>
          <a href="https://wa.me/17872345678" className={`btn-primary ${styles.contactBtn}`} target="_blank" rel="noopener noreferrer">
            Contactar al anfitrión
          </a>
        </div>
      </div>
    </section>
  );
}
