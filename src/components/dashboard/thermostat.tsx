"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronUp, ChartLine, Droplets, Fan, Flame, Power, SlidersHorizontal, Snowflake, SunSnow, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { SlotText } from "@/components/arc/slot-text/slot-text";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { OptionChips } from "./option-chips";
import { clamp, type DeviceCommand, type ThermostatDevice, type ThermostatMode } from "@/lib/devices/types";
import type { TileSize } from "@/lib/dashboard/layout";
import styles from "./thermostat.module.css";

const COMMIT_DELAY_MS = 700;
const RESTING_GLOW = 0.42;
const MODES: Record<ThermostatMode, { label: string; icon: LucideIcon }> = {
  off: { label: "Off", icon: Power }, heat: { label: "Heat", icon: Flame }, cool: { label: "Cool", icon: Snowflake },
  auto: { label: "Auto", icon: SunSnow }, dry: { label: "Dry", icon: Droplets }, fan: { label: "Fan", icon: Fan },
};
const ORDER: ThermostatMode[] = ["heat", "cool", "auto", "dry", "fan"];

/** Compact puts the arrows beside the reading, large stacks them around it, and wide sets the controls to the right with the modes along the bottom. */
type Layout = "compact" | "large" | "wide";
const layoutOf = (size?: TileSize): Layout => size === "4x2" || size === "4x3" ? "wide" : size === "3x3" ? "large" : "compact";

export const formatTemperature = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

interface ThermostatProps {
  onOpenHistory?: () => void;
  device: ThermostatDevice;
  size?: TileSize;
  /** A scaled-down copy, as in the tile editor. The rolling digits measure through the scale and overlap, so it shows plain text. */
  preview?: boolean;
  onCommand: (command: DeviceCommand) => Promise<void>;
}

export function Thermostat({ device, size, preview = false, onCommand, onOpenHistory }: ThermostatProps) {
  const reduce = useReducedMotion();
  const layout = layoutOf(size);
  const root = useRef<HTMLElement>(null);
  /** The reading's digits measure their width once, so a resized tile gets fresh ones instead of digits that overlap. */
  const [fit, setFit] = useState(0);
  const lastOn = useRef<ThermostatMode>(device.mode !== "off" ? device.mode : device.modes.find(mode => mode !== "off") ?? "heat");
  const [draft, setDraft] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const warmRest = useMotionValue(0);
  const coolRest = useMotionValue(0);
  const warmPulse = useMotionValue(0);
  const coolPulse = useMotionValue(0);

  const target = draft ?? device.target;
  const off = device.mode === "off" || !device.available;
  const demand = device.current === null || target === null ? 0 : target - device.current;
  const heating = !off && (device.action === "heating" || (device.action === null && (device.mode === "heat" || device.mode === "auto") && demand > 0.3));
  const cooling = !off && (device.action === "cooling" || (device.action === null && (device.mode === "cool" || device.mode === "auto") && demand < -0.3));

  useEffect(() => {
    const settle = reduce ? { duration: 0 } : motionTokens.spring.smooth;
    animate(warmRest, heating ? RESTING_GLOW : 0, settle);
    animate(coolRest, cooling ? RESTING_GLOW : 0, settle);
  }, [heating, cooling, reduce, warmRest, coolRest]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => { if (device.mode !== "off") lastOn.current = device.mode; }, [device.mode]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFit(Math.round(entry.contentRect.width / 16) * 1000 + Math.round(entry.contentRect.height / 16)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function pulse(direction: 1 | -1) {
    if (reduce) return;
    const [glow, other] = direction > 0 ? [warmPulse, coolPulse] : [coolPulse, warmPulse];
    animate(other, 0, { duration: motionTokens.duration.fast });
    animate(glow, [glow.get(), 1, 0.6, 0], { duration: 1.9, times: [0, 0.1, 0.45, 1], ease: "easeOut" });
  }

  async function commit(value: number) {
    setPending(true);
    setError(null);
    try {
      await onCommand({ type: "targetTemperature", value });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The thermostat did not accept the change.");
    } finally {
      setPending(false);
      setDraft(null);
    }
  }

  function nudge(direction: 1 | -1) {
    if (off || target === null) return;
    const next = clamp(Math.round((target + direction * device.step) / device.step) * device.step, device.min, device.max);
    if (next === target) return;
    setDraft(next);
    pulse(direction);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), COMMIT_DELAY_MS);
  }

  const indoor = device.current === null ? null : `Indoor ${formatTemperature(device.current)}°${device.humidity === null ? "" : ` · ${Math.round(device.humidity)}%`}`;
  const status = !device.available ? "Unavailable"
    : device.mode === "off" ? ["Off", indoor].filter(Boolean).join(" · ")
    : [heating ? "Heating" : cooling ? "Cooling" : device.mode === "dry" ? "Drying" : device.mode === "fan" ? "Fan only" : "Holding", indoor].filter(Boolean).join(" · ");
  const press = reduce ? undefined : { scale: 0.92 };
  const setMode = (mode: ThermostatMode) => void onCommand({ type: "thermostatMode", mode }).catch(cause => setError(cause instanceof Error ? cause.message : "Could not change the mode."));
  const modes = ORDER.filter(mode => device.modes.includes(mode));
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not change that.");
  const options = !preview && (device.presets.length > 0 || device.fanModes.length > 0) && (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={styles.history} aria-label={`${device.name} presets and fan`} title="Presets and fan">
          <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={`${glassSheetClass} ${styles.options}`}>
        {device.presets.length > 0 && <OptionChips label="Preset" value={device.preset} options={device.presets} disabled={!device.available} onChoose={preset => void onCommand({ type: "thermostatPreset", preset }).catch(fail)} />}
        {device.fanModes.length > 0 && <OptionChips label="Fan" value={device.fanMode} options={device.fanModes} disabled={!device.available} onChoose={mode => void onCommand({ type: "thermostatFan", mode }).catch(fail)} />}
      </PopoverContent>
    </Popover>
  );
  const canPower = device.modes.includes("off") && modes.length > 0;

  const up = (
    <motion.button type="button" className={styles.step} onClick={() => nudge(1)} whileTap={press} disabled={off || target === null || target >= device.max} aria-label={target === null ? "Raise temperature" : `Raise to ${formatTemperature(Math.min(device.max, target + device.step))}°`}>
      <ChevronUp size={30} strokeWidth={1.75} aria-hidden="true" />
    </motion.button>
  );
  const down = (
    <motion.button type="button" className={styles.step} onClick={() => nudge(-1)} whileTap={press} disabled={off || target === null || target <= device.min} aria-label={target === null ? "Lower temperature" : `Lower to ${formatTemperature(Math.max(device.min, target - device.step))}°`}>
      <ChevronDown size={30} strokeWidth={1.75} aria-hidden="true" />
    </motion.button>
  );
  const reading = (
    <p className={styles.reading}>
      {preview ? <span className={styles.number}>{target === null ? "--" : formatTemperature(target)}</span>
        : <SlotText key={fit} value={target === null ? "--" : formatTemperature(target)} spins={0} duration={0.45} stagger={0.04} announce className={styles.number} />}
      <span className={styles.degree} aria-hidden="true">°</span>
    </p>
  );
  const statusLine = (
    <p className={styles.status} aria-live="polite">
      {error ? <span className={styles.error}>{error}</span> : <TextShimmer active={pending}>{pending && target !== null ? `Setting to ${formatTemperature(target)}°` : status}</TextShimmer>}
    </p>
  );
  const power = canPower && (
    <motion.button type="button" className={styles.power} whileTap={press} aria-pressed={!off} onClick={() => setMode(off ? lastOn.current : "off")} aria-label={off ? `Turn ${device.name} on` : `Turn ${device.name} off`} title={off ? "Turn on" : "Turn off"}>
      <Power size={15} strokeWidth={1.75} aria-hidden="true" />
    </motion.button>
  );
  const modeButtons = modes.length > 1 && (
    <div role="radiogroup" aria-label="Mode" className={styles.modes}>
      {modes.map(mode => {
        const { label, icon: Icon } = MODES[mode];
        return (
          <motion.button key={mode} type="button" role="radio" aria-checked={device.mode === mode} className={styles.mode} data-mode={mode} whileTap={press} onClick={() => setMode(mode)} aria-label={label} title={label}>
            <Icon size={layout === "compact" ? 16 : 18} strokeWidth={1.75} aria-hidden="true" />
            {layout !== "compact" && <span>{label}</span>}
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <section ref={root} className={`${glassClass()} ${styles.root}`} aria-labelledby={`${device.id}-name`} data-off={off || undefined} data-layout={layout}>
      <motion.span className={styles.warm} style={{ opacity: warmRest }} aria-hidden="true" />
      <motion.span className={styles.cool} style={{ opacity: coolRest }} aria-hidden="true" />
      <motion.span className={`${styles.warm} ${styles.flash}`} style={{ opacity: warmPulse }} aria-hidden="true" />
      <motion.span className={`${styles.cool} ${styles.flash}`} style={{ opacity: coolPulse }} aria-hidden="true" />

      <header className={styles.header}>
        <h2 id={`${device.id}-name`} className={styles.name}>{device.name}</h2>
        <span className={styles.headerEnd}>
          {onOpenHistory && (
            <button type="button" className={styles.history} onClick={onOpenHistory} aria-label={`${device.name} temperature history`} title="History">
              <ChartLine size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          {options}
          <span className={styles.unit}>°{device.unit}</span>
          {power}
        </span>
      </header>

      {layout === "wide" ? (
        <div className={styles.panel}>
          <div className={styles.readout}>{reading}{statusLine}</div>
          <div className={styles.steps}>{up}{down}</div>
        </div>
      ) : layout === "compact" ? (
        <div className={styles.dial}>
          <div className={styles.row}>{down}{reading}{up}</div>
          {statusLine}
        </div>
      ) : (
        <div className={styles.dial}>{up}{reading}{statusLine}{down}</div>
      )}

      {modeButtons}
    </section>
  );
}
