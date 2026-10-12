"use client";

import { useHistory } from "../use-history";
import styles from "./mini-trend.module.css";

/** The last day of a reading as a faint line along the bottom of its tile. */
export function MiniTrend({ deviceId }: { deviceId: string }) {
  const { data } = useHistory(deviceId);
  const points = data?.points ?? [];
  if (points.length < 3) return null;
  const values = points.map(point => point.v);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const first = points[0].t, width = points.at(-1)!.t - first || 1;
  const path = points.map((point, index) => `${index ? "L" : "M"}${((point.t - first) / width * 100).toFixed(2)},${(28 - (point.v - min) / span * 24).toFixed(2)}`).join(" ");
  return (
    <svg className={styles.trend} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <path d={`${path} L100,30 L0,30 Z`} className={styles.area} />
      <path d={path} className={styles.line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
