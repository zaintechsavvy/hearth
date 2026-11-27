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
import { FanTimer } from "./fan-timer";
import { ThermostatDial, type DialTone } from "./thermostat-dial";
import { useNow } from "./use-now";
import { usePending } from "./use-pending";
import { fanDuration, fanMinutesLeft } from "@/lib/devices/fan-timer";
import { clamp, type DeviceCommand, type ThermostatDevice, type ThermostatMode } from "@/lib/devices/types";
import type { TileSize } from "@/lib/dashboard/layout";
import { cue } from "@/lib/sound";
import styles from "./thermostat.module.css";

const COMMIT_DELAY_MS = 700;
const SETTLE_MS = 10_000;
const RESTING_GLOW = 0.42;
const MODES: Record<ThermostatMode, { label: string; icon: LucideIcon }> = {
  off: { label: "Off", icon: Power }, heat: { label: "Heat", icon: Flame }, cool: { label: "Cool", icon: Snowflake },
  auto: { label: "Auto", icon: SunSnow }, dry: { label: "Dry", icon: Droplets }, fan: { label: "Fan", icon: Fan },
};
const ORDER: ThermostatMode[] = ["heat", "cool", "auto", "dry", "fan"];

/** Compact puts the arrows beside the reading, large stacks them around it, and wide sets the controls to the right with the modes along the bottom. */
type Layout = "compact" | "large" | "wide";
const layoutOf = (size?: TileSize): Layout => size === "4x2" || size === "4x3" ? "wide" : size === "3x3" ? "large" : "compact";
/** Tiles three cells tall have room for a dial a finger can drag; shorter ones keep the arrows. */
const hasDial = (size?: TileSize) => size === "3x3" || size === "4x3";

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
  const dial = hasDial(size);
  const now = useNow(10_000);
  const root = useRef<HTMLElement>(null);
  /** The reading's digits measure their width once, so a resized tile gets fresh ones instead of digits that overlap. */
  const [fit, setFit] = useState(0);
  const lastOn = useRef<ThermostatMode>(device.mode !== "off" ? device.mode : device.modes.find(mode => mode !== "off") ?? "heat");
  const [draft, setDraft] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, track] = usePending();
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

  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(settle.current); }, []);

  // A sent target stays on screen until the thermostat reports it, or for a while if it never does, so the number
  // doesn't flick back to the old one between the command and Home Assistant's update.
  if (draft !== null && !pending && device.target === draft) setDraft(null);

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
      clearTimeout(settle.current);
      settle.current = setTimeout(() => setDraft(null), SETTLE_MS);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The thermostat did not accept the change.");
      setDraft(null);
    } finally {
      setPending(false);
    }
  }

  function nudge(direction: 1 | -1) {
    if (target === null) return;
    change(clamp(Math.round((target + direction * device.step) / device.step) * device.step, device.min, device.max), true);
  }

  /** A new target from the arrows, the keys, or the dial; `settled` once it is let go, which sends it after a pause. */
  function change(next: number, settled: boolean) {
    if (off || target === null) return;
    clearTimeout(timer.current);
    clearTimeout(settle.current);
    if (next !== target) {
      cue("select", { emphasis: "subtle", direction: next > target ? "forward" : "back" });
      setDraft(next);
    }
    if (!settled) return;
    if (device.target === next) return setDraft(null);
    if (device.target !== null) pulse(next > device.target ? 1 : -1);
    timer.current = setTimeout(() => commit(next), COMMIT_DELAY_MS);
  }

  const fanLeft = device.fanMode === "on" ? fanMinutesLeft(device.fanUntil, now) : null;
  const fanNote = fanLeft !== null ? `Fan · ${fanDuration(fanLeft)} left` : device.fanTimer && device.fanMode === "on" ? "Fan on" : null;
  const tone: DialTone = off ? "off" : heating ? "warm" : cooling ? "cool" : device.mode === "heat" ? "warm" : device.mode === "cool" ? "cool" : "neutral";
  const indoor = device.current === null ? null : `Indoor ${formatTemperature(device.current)}°${device.humidity === null ? "" : ` · ${Math.round(device.humidity)}%`}`;
  const action = !device.available ? "Unavailable" : device.mode === "off" ? "Off"
    : heating ? "Heating" : cooling ? "Cooling" : device.mode === "dry" ? "Drying" : device.mode === "fan" ? "Fan only" : "Holding";
  const status = device.available ? [action, indoor].filter(Boolean).join(" · ") : action;
  const press = reduce ? undefined : { scale: 0.92 };
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not change that.");
  /** Sends a change that shows at once; it settles when the thermostat answers, having shown any failure. */
  const send = (command: DeviceCommand) => {
    setError(null);
    return onCommand(command).catch(fail);
  };
  const setMode = (mode: ThermostatMode) => void track("mode", mode, send({ type: "thermostatMode", mode }));
  const modes = ORDER.filter(mode => device.modes.includes(mode));
  const options = !preview && (device.presets.length > 0 || device.fanModes.length > 0) && (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={styles.history} aria-label={`${device.name} presets and fan`} title="Presets and fan">
          <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={`${glassSheetClass} ${styles.options}`}>
        {device.presets.length > 0 && <OptionChips label="Preset" value={device.preset} options={device.presets} disabled={!device.available} busy={slow.preset}
          onChoose={preset => void track("preset", preset, send({ type: "thermostatPreset", preset }))} />}
        {device.fanTimer ? <FanTimer device={{ ...device, fanTimer: device.fanTimer }} tone={tone} onCommand={send} />
          : device.fanModes.length > 0 && <OptionChips label="Fan" value={device.fanMode} options={device.fanModes} disabled={!device.available} busy={slow.fan}
            onChoose={mode => void track("fan", mode, send({ type: "thermostatFan", mode }))} />}
        {error && <p className={styles.optionsError} role="alert">{error}</p>}
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
        : <SlotText key={fit} value={target === null ? "--" : formatTemperature(target)} spins={0} duration={0.45} stagger={0.04} announce={!dial} className={styles.number} />}
      <span className={styles.degree} aria-hidden="true">°</span>
    </p>
  );
  const statusLine = (
    <p className={styles.status} aria-live="polite">
      {error ? <span className={styles.error}>{error}</span> : <TextShimmer active={pending}>{pending && target !== null ? `Setting to ${formatTemperature(target)}°` : status}</TextShimmer>}
    </p>
  );
  const fanLine = fanNote && <span className={styles.fanNote}><Fan size={13} strokeWidth={1.75} aria-hidden="true" />{fanNote}</span>;
  const errorLine = error && <p className={styles.status} aria-live="polite"><span className={styles.error}>{error}</span></p>;
  const power = canPower && (
    <motion.button type="button" className={styles.power} whileTap={press} aria-pressed={!off} onClick={() => setMode(off ? lastOn.current : "off")} aria-label={off ? `Turn ${device.name} on` : `Turn ${device.name} off`} title={off ? "Turn on" : "Turn off"}>
      <Power size={15} strokeWidth={1.75} aria-hidden="true" />
    </motion.button>
  );
  const modeButtons = modes.length > 1 && (
    <div role="radiogroup" aria-label="Mode" className={styles.modes}>
      {modes.map(mode => {
        const { label, icon: Icon } = MODES[mode];
        const busy = device.mode === mode && slow.mode === mode;
        return (
          <motion.button key={mode} type="button" role="radio" aria-checked={device.mode === mode} aria-busy={busy || undefined} className={styles.mode} data-mode={mode} whileTap={press} onClick={() => device.mode !== mode && setMode(mode)} aria-label={label} title={label}>
            {busy ? <span className={styles.spinner} aria-hidden="true" /> : <Icon size={layout === "compact" ? 16 : 18} strokeWidth={1.75} aria-hidden="true" />}
            {layout !== "compact" && <span>{label}</span>}
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <section ref={root} className={`${glassClass()} ${styles.root}`} aria-labelledby={`${device.id}-name`} data-off={off || undefined} data-layout={layout} data-dial={dial || undefined}>
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

      {dial && target !== null ? (
        <div className={styles.dialPanel}>
          <div className={styles.dialArea}>
            <ThermostatDial name={device.name} unit={device.unit} value={target} current={device.current} min={device.min} max={device.max} step={device.step}
              tone={tone} active={heating || cooling} disabled={off || preview} format={formatTemperature} onChange={change}>
              <span className={styles.dialAction}><TextShimmer active={pending}>{pending ? "Setting" : action}</TextShimmer></span>
              {reading}
              {layout === "large" && indoor && <span className={styles.dialIndoor}>{indoor}</span>}
              {layout === "large" && fanLine}
            </ThermostatDial>
          </div>
          {layout === "wide" ? (
            <div className={styles.readout}>
              {device.current !== null && <span className={styles.caption}>Indoor</span>}
              {device.current !== null && <p className={styles.indoor}>{formatTemperature(device.current)}<span className={styles.degree} aria-hidden="true">°</span></p>}
              {device.humidity !== null && <p className={styles.status}>Humidity {Math.round(device.humidity)}%</p>}
              {fanLine}
              {errorLine}
            </div>
          ) : errorLine}
        </div>
      ) : layout === "wide" || layout === "compact" ? (
        <div className={styles.panel}>
          <div className={styles.readout}>{reading}{statusLine}{fanLine}</div>
          <div className={styles.steps}>{up}{down}</div>
        </div>
      ) : (
        <div className={styles.stack}>{up}{reading}{statusLine}{fanLine}{down}</div>
      )}

      {modeButtons}
    </section>
  );
}
