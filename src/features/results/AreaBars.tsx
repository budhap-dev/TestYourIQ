import type { AreaResult } from '../../engine/scoring';
import { AREA_LABELS } from '../../shared/api';
import styles from './AreaBars.module.css';

/** One broad band per skill area. Positions are shown, not numbers, as each rests on few items. */
export function AreaBars({ areas }: { areas: AreaResult[] }) {
  return (
    <div>
      <div className={styles.scale} aria-hidden="true">
        <span>Below average</span>
        <span>Average</span>
        <span>Above average</span>
      </div>
      <ul className={styles.list}>
        {areas.map((a) => (
          <li key={a.area} className={styles.row}>
            <span className={styles.name}>{AREA_LABELS[a.area]}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.zone} />
              <span className={styles.zone} />
              <span className={styles.zone} />
              <span className={styles.marker} style={{ left: `${a.position * 100}%` }} />
            </span>
            <span className={styles.band}>
              <span className="visually-hidden">{AREA_LABELS[a.area]}: </span>
              {a.band[0]?.toUpperCase() + a.band.slice(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
