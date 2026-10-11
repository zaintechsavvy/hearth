"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { SlotText } from "@/components/arc/slot-text/slot-text";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassClass } from "@/components/glass/glass";
import { clamp, type DeviceCommand, type ThermostatDevice, type ThermostatMode } from "@/lib/devices/types";
import styles from "./thermostat.module.css";

const COMMIT_DELAY_MS = 700;
const RESTING_GLOW = 0.42;
const MODE_LABELS: Record<ThermostatMode, string> = { off: "Off", heat: "Heat", cool: "Cool", auto: "Auto" };

export const formatTemperature = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

interface ThermostatProps {
  device: ThermostatDevice;
  onCommand: (command: DeviceCommand) => Promise<void>;
}

export function Thermostat({ device, onCommand }: ThermostatProps) {
  const reduce = useReducedMotion();
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
  const heating = !off && (device.action === "heating" || (device.action === null && device.mode !== "cool" && demand > 0.3));
  const cooling = !off && (device.action === "cooling" || (device.action === null && device.mode !== "heat" && demand < -0.3));

  useEffect(() => {
    const settle = reduce ? { duration: 0 } : motionTokens.spring.smooth;
    animate(warmRest, heating ? RESTING_GLOW : 0, settle);
    animate(coolRest, cooling ? RESTING_GLOW : 0, settle);
  }, [heating, cooling, reduce, warmRest, coolRest]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function pulse(direction: 1 | -1) {
    if (reduce) return;
    const [glow, other] = direction > 0 ? [warmPulse, coolPulse] : [coolPulse, warmPulse];
    animate(other, 0, { duration: motionTokens.duration.fast });
    animate(glow, [glow.get(), 1, 0], { duration: 1.5, times: [0, 0.14, 1], ease: [0.22, 1, 0.36, 1] });
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

  const indoor = device.current === null ? null : `Indoor ${formatTemperature(device.current)}°`;
  const status = !device.available ? "Unavailable"
    : device.mode === "off" ? ["Off", indoor].filter(Boolean).join(" · ")
    : [heating ? "Heating" : cooling ? "Cooling" : "Holding", indoor].filter(Boolean).join(" · ");
  const press = reduce ? undefined : { scale: 0.92 };

  return (
    <section className={`${glassClass()} ${styles.root}`} aria-labelledby={`${device.id}-name`} data-off={off || undefined}>
      <motion.span className={styles.warm} style={{ opacity: warmRest }} aria-hidden="true" />
      <motion.span className={styles.cool} style={{ opacity: coolRest }} aria-hidden="true" />
      <motion.span className={`${styles.warm} ${styles.flash}`} style={{ opacity: warmPulse }} aria-hidden="true" />
      <motion.span className={`${styles.cool} ${styles.flash}`} style={{ opacity: coolPulse }} aria-hidden="true" />

      <header className={styles.header}>
        <h2 id={`${device.id}-name`} className={styles.name}>{device.name}</h2>
        <span className={styles.unit}>°{device.unit}</span>
      </header>

      <div className={styles.dial}>
        <motion.button type="button" className={styles.step} onClick={() => nudge(1)} whileTap={press} disabled={off || target === null || target >= device.max} aria-label={target === null ? "Raise temperature" : `Raise to ${formatTemperature(Math.min(device.max, target + device.step))}°`}>
          <ChevronUp size={30} strokeWidth={1.75} aria-hidden="true" />
        </motion.button>
        <p className={styles.reading}>
          <SlotText value={target === null ? "--" : formatTemperature(target)} spins={0} duration={0.45} stagger={0.04} announce className={styles.number} />
          <span className={styles.degree} aria-hidden="true">°</span>
        </p>
        <p className={styles.status} aria-live="polite">
          {error ? <span className={styles.error}>{error}</span> : <TextShimmer active={pending}>{pending && target !== null ? `Setting to ${formatTemperature(target)}°` : status}</TextShimmer>}
        </p>
        <motion.button type="button" className={styles.step} onClick={() => nudge(-1)} whileTap={press} disabled={off || target === null || target <= device.min} aria-label={target === null ? "Lower temperature" : `Lower to ${formatTemperature(Math.max(device.min, target - device.step))}°`}>
          <ChevronDown size={30} strokeWidth={1.75} aria-hidden="true" />
        </motion.button>
      </div>

      {device.modes.length > 1 && (
        <SegmentedControl
          label="Mode"
          className={styles.modes}
          value={device.mode}
          onValueChange={mode => void onCommand({ type: "thermostatMode", mode: mode as ThermostatMode }).catch(cause => setError(cause instanceof Error ? cause.message : "Could not change the mode."))}
          options={device.modes.map(mode => ({ value: mode, label: MODE_LABELS[mode] }))}
        />
      )}
    </section>
  );
}
