"use client";

import { useState } from "react";
import { FAN_MARKS, FAN_STOPS, UNTIL_OFF, fanDuration, fanMinutesLeft, fanStopLabel, fanStopMark, nearestFanIndex } from "@/lib/devices/fan-timer";
import { fanRest, type DeviceCommand, type ThermostatDevice } from "@/lib/devices/types";
import { useNow } from "./use-now";
import { usePending } from "./use-pending";
import { OptionChips, settingName } from "./option-chips";
import { StopSlider } from "./stop-slider";
import type { DialTone } from "./thermostat-dial";
import styles from "./fan-timer.module.css";

const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

interface FanTimerProps {
  device: ThermostatDevice & { fanTimer: "native" | "scripted" };
  /** The thermostat's colour now, which the slider fills with. */
  tone: DialTone;
  /** Sends a command; it settles once the thermostat has answered, and has already shown any failure. */
  onCommand: (command: DeviceCommand) => Promise<void>;
}

/** A thermostat fan's modes. On runs it until it is turned off, or for as long as the slider below says. */
export function FanTimer({ device, tone, onCommand }: FanTimerProps) {
  const now = useNow(10_000);
  const [slow, track] = usePending();
  const [draft, setDraft] = useState<number | null>(null);
  const rest = fanRest(device.fanModes) ?? "auto";
  const options = [rest, "on", ...device.fanModes.filter(mode => mode !== rest && mode !== "on")];
  const on = device.fanMode === "on";
  const left = on ? fanMinutesLeft(device.fanUntil, now) : null;
  const shown = left !== null ? nearestFanIndex(left) : UNTIL_OFF;
  const send = (option: string, command: DeviceCommand) => void track("fan", option, onCommand(command));
  const choose = (option: string) => option === "on" ? send("on", { type: "thermostatFanTimer", minutes: null })
    : option === rest ? send(rest, { type: "thermostatFanTimer", minutes: 0 }) : send(option, { type: "thermostatFan", mode: option });
  const commit = (index: number) => {
    setDraft(null);
    if (index !== shown) send("on", { type: "thermostatFanTimer", minutes: FAN_STOPS[index] });
  };
  const minutes = draft === null ? null : FAN_STOPS[draft];
  const forever = device.fanTimer === "native" ? "Nest stops it after 12 hours" : "No timer";
  const value = draft !== null ? fanStopLabel(draft) : left !== null ? fanDuration(left) : fanStopLabel(UNTIL_OFF);
  const detail = draft !== null ? minutes === null ? forever : `Off at ${clock.format(now + minutes * 60_000)}`
    : left !== null ? `Off at ${clock.format(Date.parse(device.fanUntil!))}` : forever;

  return (
    <div className={styles.fan} data-tone={tone}>
      <OptionChips label="Fan" value={device.fanMode} options={options} disabled={!device.available} busy={slow.fan}
        format={option => option === "on" ? "On" : settingName(option)} onChoose={choose} />
      {on && (
        <div className={styles.run}>
          <div className={styles.value} aria-live="polite">
            <output>{value}</output>
            <span>{detail}</span>
          </div>
          <StopSlider label="Run the fan for" count={FAN_STOPS.length} index={draft ?? shown} disabled={!device.available}
            valueText={fanStopLabel} marks={FAN_MARKS} markText={fanStopMark} onInput={setDraft} onCommit={commit} />
        </div>
      )}
      {left !== null && device.fanTimer === "scripted" && (
        <p className={styles.note}>Home Assistant turns the fan back when time is up. If Home Assistant restarts before then, the fan stays on.</p>
      )}
    </div>
  );
}
