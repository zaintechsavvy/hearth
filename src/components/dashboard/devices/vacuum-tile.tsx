"use client";

import { CircleDot, House, Locate, Pause, Play } from "lucide-react";
import { useState } from "react";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { statusText } from "@/lib/devices/status";
import type { DeviceCommand, VacuumDevice } from "@/lib/devices/types";
import styles from "./device-tiles.module.css";

/** A robot vacuum: what it is doing and its battery, one tap to start or pause, and buttons to send it home or find it. */
export function VacuumTile({ device, config, interactive, onCommand }: { device: VacuumDevice; config: TileConfig; interactive: boolean; onCommand: (command: DeviceCommand) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const cleaning = device.state === "cleaning";
  const disabled = !interactive || !device.available;
  const run = (action: Extract<DeviceCommand, { type: "vacuum" }>["action"]) => { setError(null); void onCommand({ type: "vacuum", action }).catch(cause => setError(cause instanceof Error ? cause.message : "The vacuum did not answer.")); };
  const large = config.size === "2x2";
  return (
    <section className={`${glassClass("panel")} ${styles.card}`} data-size={config.size} data-active={cleaning || undefined} data-alert={device.state === "error" || undefined} aria-label={`${device.name}, ${statusText(device)}`}>
      <div className={styles.head}>
        <span className={styles.badge} data-spin={cleaning || undefined} aria-hidden="true"><CircleDot size={20} strokeWidth={1.75} /></span>
        <span className={styles.text}>
          <span className={styles.name}>{config.label?.trim() || device.name}</span>
          <span className={styles.meta}>{error ?? statusText(device)}</span>
        </span>
        {!large && (cleaning ? device.can.pause : device.can.start) && (
          <button type="button" className={styles.round} data-lead disabled={disabled} aria-label={cleaning ? "Pause" : "Start cleaning"} onClick={() => run(cleaning ? "pause" : "start")}>
            {cleaning ? <Pause size={16} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Play size={16} strokeWidth={0} fill="currentColor" aria-hidden="true" />}
          </button>
        )}
      </div>
      {large && (
        <>
          {device.battery !== null && (
            <span className={styles.meter} aria-hidden="true"><span style={{ width: `${device.battery}%` }} data-low={device.battery < 20 || undefined} /></span>
          )}
          <div className={styles.actions}>
            {(cleaning ? device.can.pause : device.can.start) && (
              <button type="button" className={styles.pill} data-lead disabled={disabled} onClick={() => run(cleaning ? "pause" : "start")}>
                {cleaning ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}{cleaning ? "Pause" : "Clean"}
              </button>
            )}
            {device.can.dock && <button type="button" className={styles.pill} disabled={disabled || device.state === "docked"} onClick={() => run("dock")}><House size={16} strokeWidth={1.75} aria-hidden="true" />Dock</button>}
            {device.can.locate && <button type="button" className={styles.pill} disabled={disabled} aria-label="Find it" onClick={() => run("locate")}><Locate size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
          </div>
        </>
      )}
    </section>
  );
}
