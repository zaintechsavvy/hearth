import type { HistoryPoint } from "@/lib/integrations/types";

const BUCKETS = 144;

/** Averages points into evenly spaced buckets, so a month of readings draws as smoothly as an hour. */
export function downsample(points: HistoryPoint[], from: number, to: number, buckets = BUCKETS): HistoryPoint[] {
  if (points.length <= buckets) return points;
  const width = (to - from) / buckets;
  const sums = Array.from({ length: buckets }, () => ({ total: 0, count: 0 }));
  for (const point of points) {
    const index = Math.min(buckets - 1, Math.max(0, Math.floor((point.t - from) / width)));
    sums[index].total += point.v;
    sums[index].count += 1;
  }
  return sums.flatMap((sum, index) => sum.count ? [{ t: Math.round(from + (index + 0.5) * width), v: Math.round(sum.total / sum.count * 100) / 100 }] : []);
}
