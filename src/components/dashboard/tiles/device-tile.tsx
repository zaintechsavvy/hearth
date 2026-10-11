"use client";

import { useState, type CSSProperties } from "react";
import { glassClass } from "@/components/glass/glass";
import { DEFAULT_COLOR, DEFAULT_ICON, type TileConfig } from "@/lib/dashboard/layout";
import type { DeviceCommand, FanDevice, LightDevice, SwitchDevice } from "@/lib/devices/types";
import { LevelPill } from "./level-pill";
import { TILE_ICON_COMPONENTS } from "./tile-icons";
import styles from "./tile.module.css";
import level from "./level-tile.module.css";

export type ToggleDevice = LightDevice | SwitchDevice | FanDevice;

interface DeviceTileProps {
  device: ToggleDevice;
  config: TileConfig;
  onCommand: (command: DeviceCommand) => Promise<void>;
  /** False while the dashboard is being edited, so a tap selects instead of switching the device. */
  interactive?: boolean;
}

const levelOf = (device: ToggleDevice) => device.kind === "light" ? device.brightness : device.kind === "fan" ? device.speed : 0;
const hasLevel = (device: ToggleDevice) => (device.kind === "light" && device.dimmable) || (device.kind === "fan" && device.adjustable);

export function describeDevice(device: ToggleDevice, shownLevel = levelOf(device)) {
  if (!device.available) return "Unavailable";
  if (!device.on || shownLevel === 0) return "Off";
  return hasLevel(device) ? `${shownLevel}%` : "On";
}

export function DeviceTile({ device, config, onCommand, interactive = true }: DeviceTileProps) {
  const [error, setError] = useState<string | null>(null);
  const Icon = TILE_ICON_COMPONENTS[config.icon ?? DEFAULT_ICON[device.kind]];
  const color = config.color ?? DEFAULT_COLOR[device.kind];
  const disabled = !device.available || !interactive;
  const spin = device.kind === "fan" && device.on ? { "--spin-duration": `${Math.max(0.5, 3 - device.speed / 100 * 2.4)}s` } as CSSProperties : undefined;

  const run = (command: DeviceCommand) => {
    setError(null);
    onCommand(command).catch(cause => setError(cause instanceof Error ? cause.message : "The device did not respond."));
  };
  const toggle = () => run({ type: "power", on: !device.on });
  const commitLevel = (value: number) => run(device.kind === "fan" ? { type: "fanSpeed", value } : value === 0 ? { type: "power", on: false } : { type: "brightness", value });

  const icon = (size: number) => (
    <span className={styles.icon} data-spin={spin ? "" : undefined} style={spin} aria-hidden="true">
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
  const shared = { "data-color": color, "data-unavailable": !device.available || undefined, "data-size": config.size };
  const room = device.room ? `${device.room} · ` : "";

  if ((config.size === "1x2" || config.size === "2x2") && hasLevel(device)) {
    const label = `${device.name} ${device.kind === "fan" ? "speed" : "brightness"}`;
    if (config.size === "1x2") {
      return (
        <div className={`${glassClass("panel")} ${styles.tile} ${level.tall}`} {...shared} data-template="slider">
          <LevelPill label={label} value={levelOf(device)} on={device.on} disabled={disabled} onToggle={toggle} onCommit={commitLevel} className={level.fullPill}>
            {shown => (
              <span className={level.overlay} data-top={shown > 80 || undefined} data-bottom={shown > 26 || undefined}>
                <span className={level.reading}>{shown === 0 ? "Off" : `${shown}%`}</span>
                <span className={level.foot}>
                  {icon(22)}
                  <span className={styles.name}>{device.name}</span>
                  {error && <span className={`${styles.meta} ${styles.error}`}>{error}</span>}
                </span>
              </span>
            )}
          </LevelPill>
        </div>
      );
    }
    return (
      <div className={`${glassClass("panel")} ${styles.tile} ${level.large}`} {...shared} data-template="large" data-on={device.on || undefined}>
        <button type="button" className={level.largeBody} onClick={toggle} disabled={disabled} aria-pressed={device.on} aria-label={`${device.name}, ${describeDevice(device)}`}>
          <span className={styles.badge}>{icon(24)}</span>
          <span className={styles.text}>
            <span className={styles.name}>{device.name}</span>
            <span className={`${styles.meta} ${error ? styles.error : ""}`}>{error ?? `${room}${describeDevice(device)}`}</span>
          </span>
        </button>
        <LevelPill label={label} value={levelOf(device)} on={device.on} disabled={disabled} onToggle={toggle} onCommit={commitLevel} className={level.sidePill} />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${glassClass("panel")} ${styles.tile} ${styles.press}`}
      {...shared}
      data-template="toggle"
      data-on={device.on || undefined}
      onClick={toggle}
      disabled={disabled}
      aria-pressed={device.on}
      aria-label={`${device.name}${device.room ? ` in ${device.room}` : ""}, ${describeDevice(device)}`}
      title={error ?? undefined}
    >
      {config.size === "1x1" ? (
        <>
          {icon(28)}
          <span className={styles.name}>{device.name}</span>
        </>
      ) : (
        <>
          <span className={styles.badge}>{icon(22)}</span>
          <span className={styles.text}>
            <span className={styles.name}>{device.name}</span>
            <span className={`${styles.meta} ${error ? styles.error : ""}`}>{error ?? `${room}${describeDevice(device)}`}</span>
          </span>
        </>
      )}
    </button>
  );
}
