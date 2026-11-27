"use client";

import { useState } from "react";
import { Slider } from "@/components/arc/slider/slider";
import { FAN_TIMER_MINUTES, fanDuration, fanMinutesLeft } from "@/lib/devices/fan-timer";
import { fanRest, type DeviceCommand, type ThermostatDevice } from "@/lib/devices/types";
import { useNow } from "./use-now";
import { OptionChips, settingName } from "./option-chips";
import styles from "./fan-timer.module.css";

const TIMER = "timer";
const DEFAULT_INDEX = FAN_TIMER_MINUTES.indexOf(30);
const MARKS = FAN_TIMER_MINUTES.map((minutes, index) => ({ value: index, label: [10, 60, 240, 720].includes(minutes) ? fanDuration(minutes).replace(" min", "m").replace(" h", "h") : undefined }));
const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** The nearest snap point to a running timer's time left, so the slider opens where the timer is. */
const nearestIndex = (minutes: number) => FAN_TIMER_MINUTES.reduce((best, value, index) => Math.abs(value - minutes) < Math.abs(FAN_TIMER_MINUTES[best] - minutes) ? index : best, 0);

interface FanTimerProps {
  device: ThermostatDevice & { fanTimer: "native" | "scripted" };
  onCommand: (command: DeviceCommand) => void;
}

/** A thermostat fan's modes with a timer: run it for a while, until turned off, or back to auto. */
export function FanTimer({ device, onCommand }: FanTimerProps) {
  const now = useNow(10_000);
  const rest = fanRest(device.fanModes) ?? "auto";
  const left = device.fanMode === "on" ? fanMinutesLeft(device.fanUntil, now) : null;
  const [index, setIndex] = useState(() => left ? nearestIndex(left) : DEFAULT_INDEX);
  const current = left !== null ? TIMER : device.fanMode;
  const options = [rest, TIMER, "on", ...device.fanModes.filter(mode => mode !== rest && mode !== "on")];
  const run = (minutes: number | null) => onCommand({ type: "thermostatFanTimer", minutes });
  const choose = (option: string) => option === TIMER ? run(FAN_TIMER_MINUTES[index]) : option === "on" ? run(null) : option === rest ? run(0) : onCommand({ type: "thermostatFan", mode: option });
  const label = (option: string) => option === TIMER ? "Timer" : option === "on" ? "Until I turn it off" : settingName(option);
  const untimed = device.fanMode === "on" && left === null;

  return (
    <div className={styles.fan}>
      <OptionChips label="Fan" value={current} options={options} disabled={!device.available} format={label} onChoose={choose} />
      {left !== null && (
        <div className={styles.timer}>
          <Slider label="Run for" min={0} max={FAN_TIMER_MINUTES.length - 1} step={1} marks={MARKS} value={index} format={at => fanDuration(FAN_TIMER_MINUTES[at])}
            onValueChange={setIndex} onValueCommit={at => run(FAN_TIMER_MINUTES[at])} disabled={!device.available} />
        </div>
      )}
      {(left !== null || untimed) && (
        <div className={styles.running}>
          <p className={styles.left} aria-live="polite">
            {left !== null ? `Off at ${clock.format(Date.parse(device.fanUntil!))} · ${fanDuration(left)} left`
              : device.fanTimer === "native" ? "On, for up to 12 hours" : "On until you turn it off"}
          </p>
          <button type="button" className={styles.stop} disabled={!device.available} onClick={() => run(0)}>Stop</button>
        </div>
      )}
      {left !== null && device.fanTimer === "scripted" && (
        <p className={styles.note}>Home Assistant turns the fan back when time is up. If Home Assistant restarts before then, the fan stays on.</p>
      )}
    </div>
  );
}
