"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { dialColorOf, isLight, type WallSettings } from "@/lib/wall";
import { useClockNow } from "./analog-face";
import { useBoxAspect } from "./use-box-aspect";
import styles from "./luxury-face.module.css";

const H = 1000;
/** How far the minute track's inner rail sits from the screen's edge; the minute marks run from it off the screen. */
const INSET = H * .05;
const NUMERALS = ["XII", "I", "II", "III", "IIII", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
/** Advance widths of the numerals' letters in ems, before they are narrowed. */
const GLYPH: Record<string, number> = { I: .34, V: .7, X: .68 };
const NARROW = .78, TALL = 1.16;
const NUMERAL = H * .115;
/** The clear space between the track and the numerals. */
const GAP = H * .04;
/** Two decimals, so the server and the browser, whose trigonometry can differ in the last digits, draw the same marks. */
const round = (value: number) => Math.round(value * 100) / 100;

interface Track { hx: number; hy: number; r: number }
const trackOf = (width: number): Track => ({ hx: width / 2 - INSET, hy: H / 2 - INSET, r: H * .03 });

/** The point `share` (0 to 1) of the way clockwise round the track from 12 o'clock by distance, with the outward normal there. */
function around({ hx, hy, r }: Track, share: number) {
  const a = hx - r, b = hy - r, arc = Math.PI * r / 2;
  const corner = (x: number, y: number, from: number) => (t: number) => {
    const angle = (from + t * 90) * Math.PI / 180;
    return { x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r, nx: Math.cos(angle), ny: Math.sin(angle) };
  };
  const line = (x: number, y: number, dx: number, dy: number, length: number, nx: number, ny: number) => (t: number) => ({ x: x + dx * t * length, y: y + dy * t * length, nx, ny });
  const pieces: [number, (t: number) => { x: number; y: number; nx: number; ny: number }][] = [
    [a, line(0, -hy, 1, 0, a, 0, -1)], [arc, corner(a, -b, -90)], [2 * b, line(hx, -b, 0, 1, 2 * b, 1, 0)], [arc, corner(a, b, 0)],
    [2 * a, line(a, hy, -1, 0, 2 * a, 0, 1)], [arc, corner(-a, b, 90)], [2 * b, line(-hx, b, 0, -1, 2 * b, -1, 0)], [arc, corner(-a, -b, 180)],
    [a, line(-a, -hy, 1, 0, a, 0, -1)],
  ];
  let left = (((share % 1) + 1) % 1) * pieces.reduce((sum, [length]) => sum + length, 0);
  for (const [length, at] of pieces) {
    if (left <= length) return at(length ? left / length : 0);
    left -= length;
  }
  return pieces[0][1](0);
}

/**
 * Where `hours` (0 to 12) falls on the track, laid out like a Tank's dial rather than by angle, which on a wide screen
 * bunches the numerals at the middle of the long sides. XII, III, VI and IX sit at the middle of each side; on a screen
 * on its side II, IIII, VIII and X take the corners with one numeral between them along the long edges, and standing
 * up I, V, VII and XI take the corners with two along the long sides. The minutes run evenly between the hours.
 */
function onTrack(track: Track, hours: number) {
  const a = track.hx - track.r, b = track.hy - track.r, arc = Math.PI * track.r / 2;
  const corner = a + arc / 2, quarter = a + arc + b;
  const side = quarter - corner;
  const steps = track.hx >= track.hy ? [corner / 2, corner / 2, side, side, corner / 2, corner / 2] : [corner, side / 2, side / 2, side / 2, side / 2, corner];
  let h = ((hours % 12) + 12) % 12;
  let distance = h >= 6 ? 2 * quarter : 0;
  h %= 6;
  for (const step of steps) {
    if (h <= 1) return around(track, (distance + h * step) / (4 * quarter));
    distance += step;
    h -= 1;
  }
  return around(track, 0);
}

/** Degrees clockwise from 12 for a point relative to the centre. */
const bearing = (point: { x: number; y: number }) => Math.atan2(point.x, -point.y) * 180 / Math.PI;

/** How far along the ray to `point` a box `a` by `b` either side of its centre can sit and still clear the track by `GAP`. */
const inside = (track: Track, point: { x: number; y: number }, a: number, b: number) =>
  Math.min(Math.abs(point.x) > 1e-6 ? (track.hx - GAP - a) / Math.abs(point.x) : Infinity, Math.abs(point.y) > 1e-6 ? (track.hy - GAP - b) / Math.abs(point.y) : Infinity);

/** A tapered sword hand from just behind the centre to `length`, drawn pointing at 12. */
const handPath = (cx: number, cy: number, length: number, width: number, tail: number) =>
  `M ${cx - width / 2} ${cy + tail} L ${cx - width * .62} ${cy - length * .72} L ${cx} ${cy - length} L ${cx + width * .62} ${cy - length * .72} L ${cx + width / 2} ${cy + tail} Z`;

/**
 * A rectangular dress dial in the manner of a Tank or a Reverso, shaped like the screen and filling it: a railroad minute
 * track running off the screen's edges, narrow upright Roman numerals set along it, and sword hands that point at the
 * track wherever it is, so the minute hand always meets its minute.
 */
export function LuxuryFace({ night, settings }: { night: boolean; settings: WallSettings }) {
  const now = useClockNow();
  const reduce = useReducedMotion();
  const id = useId();
  const [box, aspect] = useBoxAspect<HTMLSpanElement>();
  const second = useRef<SVGGElement>(null);

  const W = Math.round(H * aspect);
  const cx = W / 2, cy = H / 2;
  const track = trackOf(W);
  const sweep = settings.secondHand === "smooth" && !reduce;

  // Sweeping, the seconds hand is turned every frame here rather than by CSS, since its speed varies round a rectangle.
  useEffect(() => {
    if (!sweep) return;
    const rail = trackOf(W);
    let frame = 0;
    const turn = () => {
      const date = new Date();
      const point = onTrack(rail, (date.getSeconds() + date.getMilliseconds() / 1000) / 5);
      second.current?.setAttribute("transform", `rotate(${bearing(point)} ${W / 2} ${H / 2})`);
      second.current?.firstElementChild?.setAttribute("y2", String(H / 2 - Math.hypot(point.x, point.y) + 8));
      frame = requestAnimationFrame(turn);
    };
    frame = requestAnimationFrame(turn);
    return () => cancelAnimationFrame(frame);
  }, [sweep, W]);

  const date = new Date(now);
  const seconds = date.getSeconds();
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;
  const dial = dialColorOf(settings);
  const light = isLight(dial);
  const style = {
    "--dial": dial,
    "--day-ink": light ? "oklch(22% 0.01 250)" : "oklch(94% 0.01 90)",
    "--day-hand": settings.handColor ?? (light ? "oklch(38% 0.12 262)" : "oklch(92% 0.03 85)"),
  } as CSSProperties;

  const ticks = Array.from({ length: 60 }, (_, minute) => {
    const { x, y, nx, ny } = onTrack(track, minute / 5);
    return <line key={minute} x1={round(cx + x)} y1={round(cy + y)} x2={round(cx + x + nx * INSET * 2)} y2={round(cy + y + ny * INSET * 2)} className={minute % 5 === 0 ? styles.hourTick : styles.tick} />;
  });
  const numerals = NUMERALS.map((text, hour) => {
    const point = onTrack(track, hour);
    const half = [...text].reduce((sum, letter) => sum + GLYPH[letter], 0) * NUMERAL * NARROW / 2;
    const scale = inside(track, point, half, NUMERAL * .36 * TALL);
    return (
      <text key={text} transform={`translate(${round(cx + point.x * scale)} ${round(cy + point.y * scale)}) scale(${NARROW} ${TALL})`} textAnchor="middle" dominantBaseline="central"
        className={styles.numeral} style={{ fontSize: NUMERAL }}>{text}</text>
    );
  });

  const hourPoint = onTrack(track, hours), minutePoint = onTrack(track, minutes / 5), secondPoint = onTrack(track, seconds / 5);
  const hourLength = round(Math.hypot(hourPoint.x, hourPoint.y) * inside(track, hourPoint, NUMERAL * .6, NUMERAL * .42) - NUMERAL * .55);
  const minuteLength = round(Math.hypot(minutePoint.x, minutePoint.y) - 6);

  return (
    <span ref={box} className={styles.face} style={style} data-night={night || undefined} data-red={(night && settings.nightRed) || undefined}>
      <span className={styles.dial} aria-hidden="true" />
      <svg className={styles.marks} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={now ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Clock"}>
        <defs>
          <linearGradient id={`${id}-hand`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "color-mix(in oklab, var(--hand) 70%, white)" }} />
            <stop offset=".5" style={{ stopColor: "var(--hand)" }} />
            <stop offset=".5" style={{ stopColor: "color-mix(in oklab, var(--hand) 78%, black)" }} />
            <stop offset="1" style={{ stopColor: "color-mix(in oklab, var(--hand) 90%, black)" }} />
          </linearGradient>
        </defs>
        {ticks}
        <rect x={round(cx - track.hx)} y={round(cy - track.hy)} width={round(2 * track.hx)} height={round(2 * track.hy)} rx={round(track.r)} className={styles.rail} />
        <rect x={round(cx - track.hx + 12)} y={round(cy - track.hy + 12)} width={round(2 * track.hx - 24)} height={round(2 * track.hy - 24)} rx={round(track.r - 12)} className={styles.innerRail} />
        {numerals}
        <text x={cx} y={round(cy - H * .2)} textAnchor="middle" dominantBaseline="central" className={styles.signature} style={{ fontSize: H * .026 }}>HEARTH</text>
        {now > 0 && (
          <g className={styles.hands}>
            <path d={handPath(cx, cy, hourLength, 30, 36)} fill={`url(#${id}-hand)`} transform={`rotate(${round(bearing(hourPoint))} ${cx} ${cy})`} />
            <path d={handPath(cx, cy, minuteLength, 20, 44)} fill={`url(#${id}-hand)`} transform={`rotate(${round(bearing(minutePoint))} ${cx} ${cy})`} />
            {settings.secondHand !== "off" && (
              <g ref={second} className={styles.second} transform={sweep ? undefined : `rotate(${round(bearing(secondPoint))} ${cx} ${cy})`}>
                <line x1={cx} y1={cy + 80} x2={cx} y2={sweep ? undefined : round(cy - Math.hypot(secondPoint.x, secondPoint.y) + 8)} strokeWidth={3} strokeLinecap="round" />
                <circle cx={cx} cy={cy + 62} r={11} />
                <circle cx={cx} cy={cy} r={9} />
              </g>
            )}
            <circle cx={cx} cy={cy} r={16} fill={`url(#${id}-hand)`} />
            <circle cx={cx} cy={cy} r={5} className={styles.cap} />
          </g>
        )}
      </svg>
    </span>
  );
}
