"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { lightTint } from "@/components/dashboard/light-controls";
import type { Device } from "@/lib/devices/types";
import { sentHere } from "@/lib/sent-here";
import { HangingBulb } from "./hanging-bulb";
import styles from "./device-moment.module.css";

/** How long each moment holds the screen before the next, or the clock, comes back. */
const HOLD_MS = 3200;

type Moment =
  | { key: string; kind: "light"; name: string; room: string | null; on: boolean; tint: string | null; chandelier: boolean }
  | { key: string; kind: "fan"; name: string; room: string | null; on: boolean; standing: boolean };

/** The settled state worth a moment, or null for a device that has none or is still moving. */
function stateOf(device: Device): string | null {
  if (!device.available) return null;
  if (device.kind === "light" || device.kind === "fan") return device.on ? "on" : "off";
  return null;
}

function momentOf(device: Device, state: string): Moment | null {
  const key = `${device.id}-${state}-${Date.now()}`;
  // A white light glows warm, as its tile does; only a coloured one takes its colour.
  if (device.kind === "light") return { key, kind: "light", name: device.name, room: device.room, on: state === "on", tint: device.colorMode === "color" ? lightTint(device) : null, chandelier: /chandelier/i.test(device.name) };
  if (device.kind === "fan") return { key, kind: "fan", name: device.name, room: device.room, on: state === "on", standing: STANDING.test(device.name) };
  return null;
}

/** Fans named like these stand on the floor or a table; any other fan hangs from the ceiling. */
const STANDING = /\b(stand(ing)?|pedestal|floor|desk|table|tower|box|oscillating|portable)\b/i;

/**
 * Full-screen moments on a wall tablet, resting or awake: a light or fan someone changes elsewhere plays a short scene
 * of it changing, one after another. A change made on this screen plays on its own tile instead. It never wakes the
 * screen. Locks and garage doors have their own notice, `StateNotices`, which plays `LockScene` and `GarageScene`.
 */
export function DeviceMoments({ devices }: { devices: Device[] | undefined }) {
  const seen = useRef<Map<string, string> | null>(null);
  const [queue, setQueue] = useState<Moment[]>([]);
  useEffect(() => {
    if (!devices) return;
    const known = seen.current;
    const next = new Map<string, string>();
    const fresh: Moment[] = [];
    for (const device of devices) {
      const state = stateOf(device);
      if (state === null) { if (known?.has(device.id)) next.set(device.id, known.get(device.id)!); continue; }
      next.set(device.id, state);
      const before = known?.get(device.id);
      if (before !== undefined && before !== state && !sentHere(device.id)) {
        const moment = momentOf(device, state);
        if (moment) fresh.push(moment);
      }
    }
    seen.current = next;
    if (!fresh.length) return;
    const timer = setTimeout(() => setQueue(current => [...current, ...fresh].slice(-4)), 0);
    return () => clearTimeout(timer);
  }, [devices]);

  useEffect(() => {
    if (!queue.length) return;
    const timer = setTimeout(() => setQueue(current => current.slice(1)), HOLD_MS);
    return () => clearTimeout(timer);
  }, [queue]);

  const moment = queue[0];
  return (
    <AnimatePresence>
      {moment && (
        <motion.div key={moment.key} className={styles.moment} data-kind={moment.kind} role="status" aria-live="polite"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <Scene moment={moment} />
          <motion.div className={styles.caption} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
            <p className={styles.label}>{moment.name}</p>
            <p className={styles.detail}>{moment.on ? "Turned on" : "Turned off"}{moment.room && !moment.name.toLowerCase().includes(moment.room.toLowerCase()) ? ` · ${moment.room}` : ""}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Starts in the old state, then flips a beat later so the scene plays the change itself; `still` starts in the new one. */
function useFlip(target: boolean, still = false) {
  const [shown, setShown] = useState(still ? target : !target);
  useEffect(() => {
    const timer = setTimeout(() => setShown(target), 260);
    return () => clearTimeout(timer);
  }, [target]);
  return shown;
}

function Scene({ moment }: { moment: Moment }) {
  if (moment.kind === "fan") return moment.standing ? <StandingFanScene on={moment.on} /> : <FanScene on={moment.on} />;
  return moment.chandelier ? <ChandelierScene on={moment.on} tint={moment.tint} /> : <LightScene on={moment.on} tint={moment.tint} />;
}

function Bloom({ shown }: { shown: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span className={styles.bloom} initial={false} animate={{ opacity: shown ? (reduce ? 1 : [0, .8, .2, 1, .6, 1]) : (reduce ? 0 : [1, .3, .7, .1, 0]) }}
      transition={{ duration: reduce ? 0 : shown ? .8 : .6, ease: "linear" }} aria-hidden="true" />
  );
}

function LightScene({ on, tint }: { on: boolean; tint: string | null }) {
  const shown = useFlip(on);
  return (
    <div className={styles.stage} style={{ "--glow": tint ?? "var(--lit-warm)" } as CSSProperties}>
      <Bloom shown={shown} />
      <span className={styles.bulb}><HangingBulb on={shown} size={360} tint={tint} /></span>
    </div>
  );
}

const ARMS = 6;

/** Candle arms on a ring seen from a little above, the far ones behind the column, swaying gently as it lights. */
function ChandelierScene({ on, tint }: { on: boolean; tint: string | null }) {
  const shown = useFlip(on);
  const reduce = useReducedMotion();
  const id = useId();
  const arms = Array.from({ length: ARMS }, (_, index) => {
    const angle = 0.3 + (index / ARMS) * Math.PI * 2;
    const depth = Math.cos(angle);
    return { index, x: Math.sin(angle) * 112, y: 18 + depth * 30, depth, scale: 1 + depth * 0.12 };
  }).sort((a, b) => a.depth - b.depth);
  const arm = ({ index, x, y, depth, scale }: (typeof arms)[number]) => (
    <g key={index} opacity={0.72 + (depth + 1) * 0.14}>
      <path d={`M ${x * 0.06} 6 C ${x * 0.3} ${62 * scale}, ${x * 0.95} ${y + 52 * scale}, ${x} ${y}`} className={styles.arm} stroke={`url(#${id}-brass)`} strokeWidth={5 * scale} />
      <ellipse cx={x} cy={y} rx={13 * scale} ry={4.5 * scale} fill={`url(#${id}-brass)`} />
      <rect x={x - 4.5 * scale} y={y - 26 * scale} width={9 * scale} height={26 * scale} rx={2} className={styles.candle} />
      <motion.circle cx={x} cy={y - 38 * scale} r={34 * scale} fill={`url(#${id}-halo)`} initial={false}
        animate={{ opacity: shown ? (reduce ? 1 : [0, .9, .3, 1]) : (reduce ? 0 : [1, .4, 0]) }}
        transition={{ duration: reduce ? 0 : .5, delay: reduce ? 0 : .15 + index * .11, ease: "linear" }} />
      <path d={`M ${x} ${y - 48 * scale} C ${x + 6 * scale} ${y - 40 * scale}, ${x + 5 * scale} ${y - 29 * scale}, ${x} ${y - 27 * scale} C ${x - 5 * scale} ${y - 29 * scale}, ${x - 6 * scale} ${y - 40 * scale}, ${x} ${y - 48 * scale} Z`}
        className={styles.flame} data-on={shown || undefined} style={{ transitionDelay: `${0.15 + index * 0.11}s` }} />
    </g>
  );
  return (
    <div className={styles.stage} style={{ "--glow": tint ?? "var(--lit-warm)" } as CSSProperties}>
      <Bloom shown={shown} />
      <motion.svg viewBox="-160 -150 320 290" className={styles.chandelier} aria-hidden="true" style={{ originX: "50%", originY: "0%" }}
        initial={false} animate={reduce ? undefined : { rotate: [0, 1.6, -1.2, .6, 0] }} transition={{ duration: 3, ease: "easeInOut" }}>
        <defs>
          <linearGradient id={`${id}-brass`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="oklch(88% .09 85)" />
            <stop offset=".45" stopColor="oklch(68% .11 75)" />
            <stop offset="1" stopColor="oklch(42% .07 65)" />
          </linearGradient>
          <linearGradient id={`${id}-column`} x1="0" x2="1">
            <stop offset="0" stopColor="oklch(45% .07 65)" />
            <stop offset=".35" stopColor="oklch(90% .08 85)" />
            <stop offset="1" stopColor="oklch(40% .06 65)" />
          </linearGradient>
          <radialGradient id={`${id}-halo`}>
            <stop offset="0" stopColor="var(--glow)" stopOpacity=".95" />
            <stop offset=".35" stopColor="var(--glow)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--glow)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={0} cy={-146} rx={26} ry={6} fill={`url(#${id}-column)`} />
        <line x1={0} y1={-142} x2={0} y2={-70} className={styles.chain} />
        {arms.filter(item => item.depth < 0).map(arm)}
        <path d="M -9 -72 L 9 -72 L 12 -40 C 26 -30 26 -6 14 4 L 18 22 C 18 34 -18 34 -18 22 L -14 4 C -26 -6 -26 -30 -12 -40 Z" fill={`url(#${id}-column)`} />
        <circle cx={0} cy={44} r={7} fill={`url(#${id}-column)`} />
        {arms.filter(item => item.depth >= 0).map(arm)}
      </motion.svg>
    </div>
  );
}

const BLADES = [0, 72, 144, 216, 288];
const round = (value: number) => Math.round(value * 100) / 100;

/** A ceiling fan seen from a little above: the blades turn in a tilted plane that passes behind the motor. */
function FanScene({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className={`${styles.stage} ${styles.depth} ${styles.fanStage}`}>
      <motion.span className={styles.breeze} initial={{ opacity: 0 }} animate={{ opacity: on ? [0, .7, .4] : [.4, 0] }} transition={{ duration: 2 }} aria-hidden="true" />
      <div className={styles.fanRig}>
        <svg viewBox="0 0 100 92" className={styles.fanMount} aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-metal`} x1="0" x2="1">
              <stop offset="0" stopColor="oklch(38% .01 250)" />
              <stop offset=".35" stopColor="oklch(86% .01 250)" />
              <stop offset=".6" stopColor="oklch(62% .01 250)" />
              <stop offset="1" stopColor="oklch(30% .01 250)" />
            </linearGradient>
          </defs>
          <path d="M 34 0 L 66 0 L 60 9 L 40 9 Z" fill={`url(#${id}-metal)`} />
          <rect x={47.5} y={9} width={5} height={50} fill={`url(#${id}-metal)`} />
          <path d="M 30 62 C 30 56 70 56 70 62 L 74 84 C 74 94 26 94 26 84 Z" fill={`url(#${id}-metal)`} />
          <path d="M 28 72 L 72 72" className={styles.seam} />
        </svg>
        <div className={styles.fanPlane}>
          <motion.svg viewBox="-100 -100 200 200" className={styles.fanBlades} aria-hidden="true"
            initial={{ rotate: 0 }} animate={{ rotate: reduce ? 0 : on ? 1800 : 300 }} transition={{ duration: on ? 3.2 : 2.6, ease: on ? [.55, 0, 1, .8] : [0, .5, .3, 1] }}>
            <defs>
              <linearGradient id={`${id}-wood`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="oklch(58% .07 55)" />
                <stop offset=".5" stopColor="oklch(46% .07 50)" />
                <stop offset="1" stopColor="oklch(36% .06 45)" />
              </linearGradient>
            </defs>
            {BLADES.map(angle => (
              <g key={angle} transform={`rotate(${angle})`}>
                <path d="M -6 -26 L -17 -84 Q -16 -97 0 -97 Q 16 -97 17 -84 L 6 -26 Z" fill={`url(#${id}-wood)`} className={styles.blade} />
                <path d="M -3 -12 L -5 -40 L 5 -40 L 3 -12 Z" className={styles.iron} />
              </g>
            ))}
          </motion.svg>
          <motion.span className={styles.fanBlur} initial={{ opacity: on ? 0 : .55 }} animate={{ opacity: reduce ? 0 : on ? [0, 0, .55] : [.55, 0] }} transition={{ duration: on ? 3.2 : 1.6 }} aria-hidden="true" />
        </div>
        <svg viewBox="0 0 40 24" className={styles.fanCap} aria-hidden="true">
          <path d="M 2 2 L 38 2 C 38 16 30 23 20 23 C 10 23 2 16 2 2 Z" className={styles.fanGlass} />
          <rect x={0} y={0} width={40} height={4} rx={2} fill={`url(#${id}-metal)`} />
        </svg>
      </div>
    </div>
  );
}

/** A pedestal fan facing you: the blades spin behind the grille, and the head turns from side to side as it runs. */
function StandingFanScene({ on }: { on: boolean }) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div className={`${styles.stage} ${styles.depth} ${styles.fanStage}`}>
      <motion.span className={styles.breeze} initial={{ opacity: 0 }} animate={{ opacity: on ? [0, .7, .4] : [.4, 0] }} transition={{ duration: 2 }} aria-hidden="true" />
      <svg viewBox="0 0 100 100" className={styles.standBase} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-pole`} x1="0" x2="1">
            <stop offset="0" stopColor="oklch(40% .01 250)" />
            <stop offset=".4" stopColor="oklch(88% .01 250)" />
            <stop offset="1" stopColor="oklch(34% .01 250)" />
          </linearGradient>
          <radialGradient id={`${id}-base`} cx="45%" cy="30%">
            <stop offset="0" stopColor="oklch(70% .01 250)" />
            <stop offset="1" stopColor="oklch(26% .01 250)" />
          </radialGradient>
        </defs>
        <rect x={48} y={40} width={4} height={50} fill={`url(#${id}-pole)`} />
        <ellipse cx={50} cy={92} rx={20} ry={5} fill={`url(#${id}-base)`} />
      </svg>
      <motion.div className={styles.standHead} initial={false} transition={{ duration: on ? 3.2 : 1.4, ease: "easeInOut" }}
        animate={reduce ? undefined : { rotateY: on ? [0, -22, 14] : [14, 0], rotateX: 6 }}>
        <svg viewBox="-100 -100 200 200" className={styles.standLayer} style={{ transform: "translateZ(-34px)" }} aria-hidden="true">
          <circle r={34} fill={`url(#${id}-pole)`} />
        </svg>
        <motion.svg viewBox="-100 -100 200 200" className={styles.standLayer} style={{ transform: "translateZ(-10px)" }} aria-hidden="true"
          initial={{ rotate: 0 }} animate={{ rotate: reduce ? 0 : on ? 2200 : 360 }} transition={{ duration: on ? 3.2 : 2.6, ease: on ? [.55, 0, 1, .8] : [0, .5, .3, 1] }}>
          {[0, 120, 240].map(angle => <path key={angle} transform={`rotate(${angle})`} d="M 0 -10 C 30 -24 52 -70 24 -86 C 6 -94 -14 -82 -12 -56 C -10 -38 -6 -22 0 -10 Z" className={styles.standBlade} />)}
        </motion.svg>
        <motion.span className={styles.standBlur} initial={{ opacity: on ? 0 : .5 }} animate={{ opacity: reduce ? 0 : on ? [0, 0, .5] : [.5, 0] }} transition={{ duration: on ? 3.2 : 1.6 }} aria-hidden="true" />
        <svg viewBox="-100 -100 200 200" className={styles.standLayer} aria-hidden="true">
          {[96, 74, 50].map(r => <circle key={r} r={r} className={styles.grille} />)}
          {Array.from({ length: 28 }, (_, i) => {
            const a = i / 28 * Math.PI * 2;
            return <line key={i} x1={round(Math.cos(a) * 20)} y1={round(Math.sin(a) * 20)} x2={round(Math.cos(a) * 96)} y2={round(Math.sin(a) * 96)} className={styles.grilleWire} />;
          })}
          <circle r={99} className={styles.grilleRim} />
          <circle r={18} fill={`url(#${id}-pole)`} />
        </svg>
      </motion.div>
    </div>
  );
}

/** A brass padlock that turns toward you as its chrome shackle swings round and drops in, and the key turns. */
/** `inTile` draws it as a tile's icon: it opens in its current state and plays only a change. */
export function LockScene({ locked, small = false, inTile = false }: { locked: boolean; small?: boolean; inTile?: boolean }) {
  const shown = useFlip(locked, inTile);
  const reduce = useReducedMotion();
  const id = useId();
  const quick = reduce ? { duration: 0 } : undefined;
  return (
    <div className={`${styles.stage} ${styles.depth} ${small || inTile ? styles.small : ""}`} data-locked={shown || undefined}>
      {!inTile && <motion.span className={styles.ring} initial={false} animate={shown && !reduce ? { scale: [0.6, 1.25], opacity: [0.7, 0] } : { opacity: 0 }} transition={{ duration: 1.1, delay: .9, ease: "easeOut" }} aria-hidden="true" />}
      <motion.div className={`${styles.padlock} ${inTile ? styles.padlockTile : ""}`} initial={false} animate={reduce ? undefined : { rotateY: shown ? [-26, 8, 0] : [0, -20, -14], rotateX: [4, 8, 4] }} transition={{ duration: 1.4, ease: "easeInOut" }}>
        <motion.svg viewBox="-60 -80 120 150" className={styles.lockLayer} aria-hidden="true" initial={false} style={{ originX: "76.6%", originY: "50%" }}
          animate={shown ? { y: "0%", rotateY: 0 } : { y: "-11%", rotateY: -150 }}
          transition={quick ?? (shown ? { rotateY: { duration: .55, ease: "easeInOut" }, y: { delay: .55, duration: .22, ease: [.6, 0, 1, 1] } } : { y: { duration: .3, ease: "easeOut" }, rotateY: { delay: .3, duration: .6, ease: "easeInOut" } })}>
          <defs>
            <linearGradient id={`${id}-chrome`} x1="-32" x2="32" y1="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="oklch(55% .01 250)" />
              <stop offset=".2" stopColor="oklch(96% 0 0)" />
              <stop offset=".5" stopColor="oklch(62% .01 250)" />
              <stop offset=".8" stopColor="oklch(92% 0 0)" />
              <stop offset="1" stopColor="oklch(50% .01 250)" />
            </linearGradient>
          </defs>
          <path d="M -32 4 L -32 -36 A 32 32 0 0 1 32 -36 L 32 4" className={styles.shackle} stroke={`url(#${id}-chrome)`} />
          <path d="M -27 -36 A 27 27 0 0 1 -8 -61" className={styles.shackleShine} />
        </motion.svg>
        <svg viewBox="-60 -80 120 150" className={styles.lockLayer} aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-brass`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="oklch(90% .1 88)" />
              <stop offset=".4" stopColor="oklch(74% .13 78)" />
              <stop offset="1" stopColor="oklch(46% .09 65)" />
            </linearGradient>
            <radialGradient id={`${id}-core`} cx="40%" cy="35%">
              <stop offset="0" stopColor="oklch(92% 0 0)" />
              <stop offset="1" stopColor="oklch(55% .01 250)" />
            </radialGradient>
          </defs>
          <rect x={-40} y={-2} width={92} height={74} rx={16} className={styles.lockSide} />
          <rect x={-46} y={-8} width={92} height={74} rx={16} fill={`url(#${id}-brass)`} />
          <rect x={-41} y={-3} width={82} height={64} rx={12} className={styles.bevel} />
          <path d="M -40 8 L -18 -6 L 2 -6 L -40 22 Z" className={styles.gleam} />
          <circle cx={0} cy={28} r={13} fill={`url(#${id}-core)`} />
          <motion.g initial={false} animate={{ rotate: shown ? 0 : -90 }} transition={reduce ? { duration: 0 } : { duration: .4, delay: shown ? .8 : 0 }} style={{ originX: "0px", originY: "28px" }}>
            <rect x={-2.5} y={19} width={5} height={18} rx={2.5} className={styles.keyhole} />
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}

/** A garage door that slides slowly up into its opening, or back down, as the light inside comes on or goes out. */
export function GarageScene({ open, small = false, inTile = false }: { open: boolean; small?: boolean; inTile?: boolean }) {
  const reduce = useReducedMotion();
  const id = useId();
  const travel = { duration: reduce ? 0 : 3.4, ease: [.42, 0, .2, 1] as const, delay: reduce ? 0 : .3 };
  const light = { duration: reduce ? 0 : .8, delay: reduce ? 0 : open ? .5 : 2.6 };
  return (
    <div className={`${styles.stage} ${small || inTile ? styles.small : ""}`}>
      <div className={styles.garageBox}>
        <svg viewBox="0 0 240 220" className={styles.garageArt} aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-inside`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="oklch(16% .01 250)" />
              <stop offset="1" stopColor="oklch(9% .01 250)" />
            </linearGradient>
            <radialGradient id={`${id}-lamp`} cx="50%" cy="0%" r="90%">
              <stop offset="0" stopColor="oklch(88% .08 80)" stopOpacity=".75" />
              <stop offset="1" stopColor="oklch(70% .08 75)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-spill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="oklch(85% .08 80)" stopOpacity=".55" />
              <stop offset="1" stopColor="oklch(85% .08 80)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 40 196 L 200 196 L 238 220 L 2 220 Z" className={styles.drive} />
          <path d="M 8 74 L 120 14 L 232 74 L 232 196 L 8 196 Z" className={styles.house} />
          {[96, 112, 128, 144, 160, 176].map(y => <line key={y} x1={10} x2={230} y1={y} y2={y} className={styles.siding} />)}
          <path d="M 2 78 L 120 8 L 238 78" className={styles.roof} />
          <rect x={40} y={86} width={160} height={110} fill={`url(#${id}-inside)`} />
          <motion.g initial={inTile ? false : { opacity: open ? 0 : 1 }} animate={{ opacity: open ? 1 : 0 }} transition={light}>
            <rect x={40} y={86} width={160} height={110} fill={`url(#${id}-lamp)`} />
            <rect x={104} y={88} width={32} height={3} rx={1.5} className={styles.lampBar} />
            <path d="M 40 196 L 200 196 L 232 220 L 8 220 Z" fill={`url(#${id}-spill)`} />
          </motion.g>
          <path d="M 72 194 L 72 168 C 72 160 78 156 86 155 L 96 138 C 99 134 104 132 110 132 L 130 132 C 136 132 141 134 144 138 L 154 155 C 162 156 168 160 168 168 L 168 194 Z" className={styles.car} />
          <rect x={76} y={164} width={14} height={5} rx={2} className={styles.tail} />
          <rect x={150} y={164} width={14} height={5} rx={2} className={styles.tail} />
          <rect x={40} y={86} width={160} height={110} className={styles.frame} />
        </svg>
        <div className={styles.opening}>
          <motion.div className={styles.door} initial={inTile ? false : { y: open ? "0%" : "-96%" }} animate={{ y: open ? "-96%" : "0%" }} transition={travel}>
            {Array.from({ length: 4 }, (_, row) => (
              <span key={row} className={styles.doorRow} data-glass={row === 0 || undefined}>
                {Array.from({ length: 4 }, (_, cell) => <span key={cell} className={styles.doorPanel} />)}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
