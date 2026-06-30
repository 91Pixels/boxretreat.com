import styles from './GearSection.module.css';

const SnorkelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.svgIcon}>
    <ellipse cx="12" cy="11" rx="7" ry="4.5" stroke="currentColor" />
    <path d="M5 11c0 0-2 .8-2 2.5S5 16 5 16h14s2-.8 2-2.5S19 11 19 11" stroke="currentColor" />
    <line x1="15.5" y1="6.5" x2="15.5" y2="3" stroke="currentColor" />
    <path d="M15.5 3 Q15.5 1.5 17 1.5 Q18.5 1.5 18.5 3 L18.5 7" stroke="currentColor" />
  </svg>
);

const KayakIcon = () => (
  <svg viewBox="-3 -3 30 30" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.svgIcon}>
    <line x1="7" y1="7" x2="17" y2="17" stroke="currentColor" />
    <ellipse cx="3.5" cy="3.5" rx="4.5" ry="2" transform="rotate(45 3.5 3.5)" stroke="currentColor" />
    <ellipse cx="20.5" cy="20.5" rx="4.5" ry="2" transform="rotate(45 20.5 20.5)" stroke="currentColor" />
    <line x1="17" y1="7" x2="7" y2="17" stroke="currentColor" />
    <ellipse cx="20.5" cy="3.5" rx="4.5" ry="2" transform="rotate(-45 20.5 3.5)" stroke="currentColor" />
    <ellipse cx="3.5" cy="20.5" rx="4.5" ry="2" transform="rotate(-45 3.5 20.5)" stroke="currentColor" />
  </svg>
);

const GEAR = [
  { id: 'surfboard',  icon: <i className="bi bi-tsunami" />,       name: 'Surfboard',   price: '$35 / day' },
  { id: 'snorkel',    icon: <SnorkelIcon />,                        name: 'Snorkel set', price: '$15 / day' },
  { id: 'kayak',      icon: <KayakIcon />,                          name: 'Kayak',       price: '$45 / day' },
  { id: 'gopro',      icon: <i className="bi bi-camera-fill" />,   name: 'GoPro',       price: '$25 / day' },
  { id: 'bike',       icon: <i className="bi bi-bicycle" />,        name: 'Bike',        price: '$20 / day' },
  { id: 'beach-set',  icon: <i className="bi bi-umbrella-fill" />, name: 'Beach set',   price: '$18 / day' },
];

export function GearSection() {
  return (
    <section className={styles.section} id="gear" aria-label="Gear rental">
      <div className={styles.inner}>
        <p className="eyebrow">Gear rental</p>
        <h2 className={styles.title}>Gear up. We bring it to the cabin.</h2>
        <ul className={styles.list} role="list">
          {GEAR.map(({ id, icon, name, price }) => (
            <li key={name} className={styles.item}>
              <div className={styles.ico} aria-hidden="true">{icon}</div>
              <div className={styles.info}>
                <p className={styles.name}>{name}</p>
                <p className={styles.price}>{price}</p>
              </div>
              <a href={`/gear?item=${id}`} className={styles.btn}>Add to stay</a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
