import styles from './ExploreSection.module.css';

const ITEMS = [
  { icon: 'bi-water',       name: 'Luquillo Beach',      desc: '2 min walk · calm waters, surf breaks, food kiosks along the shore' },
  { icon: 'bi-tree-fill',   name: 'El Yunque Rainforest', desc: '15 min drive · hiking trails, waterfalls, and incredible wildlife' },
  { icon: 'bi-wind',        name: 'Surf spots',           desc: 'La Pared, El Toro — beginner to advanced breaks just minutes away' },
  { icon: 'bi-cup-hot-fill',name: 'Local food & culture', desc: '5 min walk · kiosks, cocina criolla, fresh seafood and local markets' },
  { icon: 'bi-building',    name: 'Old San Juan',         desc: '45 min drive · colorful streets, history, art galleries and nightlife' },
];

export function ExploreSection() {
  return (
    <section className={styles.section} id="explore" aria-label="Explore the area">
      <div className={styles.inner}>
        <p className="eyebrow">Explore the area</p>
        <h2 className={styles.title}>Everything you need is right outside.</h2>
        <ul className={styles.list} role="list">
          {ITEMS.map(({ icon, name, desc }) => (
            <li key={name} className={styles.item}>
              <div className={styles.ico} aria-hidden="true">
                <i className={`bi ${icon}`} />
              </div>
              <div>
                <p className={styles.name}>{name}</p>
                <p className={styles.desc}>{desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
