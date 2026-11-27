/** The dial's arc: 270 degrees, from the coolest setting at the bottom left to the warmest at the bottom right. Angles are degrees clockwise from 12 o'clock. */
export const DIAL_START = -135;
export const DIAL_SWEEP = 270;

export interface DialRange { min: number; max: number; step: number }

/** A value on the device's own steps from its minimum, without the float dust 0.1 + 0.2 leaves. */
export function snap(value: number, { min, max, step }: DialRange) {
  const steps = Math.round((Math.min(max, Math.max(min, value)) - min) / step);
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Number(Math.min(max, min + steps * step).toFixed(decimals));
}

export function valueToAngle(value: number, { min, max }: DialRange) {
  const share = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  return DIAL_START + share * DIAL_SWEEP;
}

/** The angle of a point from the dial's centre. */
export const pointAngle = (dx: number, dy: number) => Math.atan2(dx, -dy) * 180 / Math.PI;

/**
 * The snapped value under an angle. In the gap at the bottom the value holds at whichever end is nearer to `from`,
 * so a drag past the coolest end never jumps to the warmest.
 */
export function angleToValue(angle: number, range: DialRange, from: number) {
  if (angle < DIAL_START || angle > DIAL_START + DIAL_SWEEP) {
    return Math.abs(from - range.min) <= Math.abs(from - range.max) ? range.min : range.max;
  }
  return snap(range.min + (angle - DIAL_START) / DIAL_SWEEP * (range.max - range.min), range);
}

export function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: cx + radius * Math.sin(radians), y: cy - radius * Math.cos(radians) };
}

/** An SVG path along the circle from one angle to a larger one. */
export function arcPath(cx: number, cy: number, radius: number, from: number, to: number) {
  const start = polar(cx, cy, radius, from), end = polar(cx, cy, radius, Math.max(from, to));
  const large = to - from > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

/** Ticks a person can read: one per whole degree, or every second or fifth one on a wide range. */
export function tickValues({ min, max }: DialRange) {
  const span = max - min;
  const every = span <= 40 ? 1 : span <= 80 ? 2 : 5;
  const values: number[] = [];
  for (let value = Math.ceil(min / every) * every; value <= max; value += every) values.push(value);
  return values;
}
