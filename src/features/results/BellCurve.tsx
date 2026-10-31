import { useEffect, useRef, useState } from 'react';
import styles from './BellCurve.module.css';

const H = 210;
const LEFT = 18;
const RIGHT = 18;
const TOP = 40;
const BOTTOM = 30;
const MIN = 55;
const MAX = 145;

const base = H - BOTTOM;
const y = (iq: number) => base - Math.exp(-0.5 * ((iq - 100) / 15) ** 2) * (base - TOP);

/** Track the element's width so the SVG is drawn at 1:1 scale and its text stays legible. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(260, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

interface BellCurveProps {
  iq: number;
  low: number;
  high: number;
  label: string;
  who: string;
}

/** Spread of scores in the age group, with the person's estimate and likely range marked. */
export function BellCurve({ iq, low, high, label, who }: BellCurveProps) {
  const [ref, W] = useWidth(600);
  const x = (v: number) => LEFT + ((v - MIN) / (MAX - MIN)) * (W - LEFT - RIGHT);
  const curve = (from: number, to: number) => {
    const pts: string[] = [];
    for (let v = from; v <= to + 1e-9; v += 0.5) pts.push(`${x(v).toFixed(1)},${y(v).toFixed(1)}`);
    return pts;
  };
  const youX = x(iq);
  const labelX = Math.min(W - 44, Math.max(44, youX));
  const ticks = W < 420 ? [70, 100, 130] : [70, 85, 100, 115, 130];

  return (
    <figure className={styles.figure} ref={ref}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Bell curve of scores for ${who}. Your estimate, ${label}, is marked; the shaded band shows your likely range, ${low} to ${high}.`}
      >
        <polygon
          className={styles.population}
          points={[`${x(MIN)},${base}`, ...curve(MIN, MAX), `${x(MAX)},${base}`].join(' ')}
        />
        <polygon
          className={styles.range}
          points={[`${x(low)},${base}`, ...curve(low, high), `${x(high)},${base}`].join(' ')}
        />
        <line className={styles.rangeEdge} x1={x(low)} x2={x(low)} y1={base} y2={y(low)} />
        <line className={styles.rangeEdge} x1={x(high)} x2={x(high)} y1={base} y2={y(high)} />
        <line className={styles.axis} x1={LEFT} x2={W - RIGHT} y1={base} y2={base} />
        {ticks.map((t) => (
          <text key={t} className={styles.tick} x={x(t)} y={H - 8} textAnchor="middle">
            {t}
          </text>
        ))}
        <line className={styles.marker} x1={youX} x2={youX} y1={base} y2={y(iq)} />
        <circle className={styles.dot} cx={youX} cy={y(iq)} r={7} />
        <text className={styles.you} x={labelX} y={Math.min(y(iq), base) - 14} textAnchor="middle">
          You · {label}
        </text>
      </svg>
      <figcaption className={styles.caption}>
        How scores spread among {who}. Most people score near 100. The shaded band is where your
        score most likely falls.
      </figcaption>
    </figure>
  );
}
