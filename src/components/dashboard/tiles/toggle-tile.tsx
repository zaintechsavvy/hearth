"use client";

import { useState, type CSSProperties } from "react";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { defaultStyle } from "@/lib/dashboard/style";
import type { DeviceCommand, FanDevice, LightDevice, SwitchDevice } from "@/lib/devices/types";
import { hasControls, lightTint } from "../light-controls";
import { LevelPill } from "./level-pill";
import { TILE_ICON_COMPONENTS } from "./tile-icons";
import styles from "./tile.module.css";
import level from "./level-tile.module.css";
import { useLongPress } from "./use-long-press";

export type ToggleDevice = LightDevice | SwitchDevice | FanDevice;

interface ToggleTileProps {
  device: ToggleDevice;
  config: TileConfig;
  onCommand: (command: DeviceCommand) => Promise<void>;
  /** False while the dashboard is being edited, so a tap selects instead of switching the device. */
  interactive?: boolean;
  /** Opens colour, white, and brightness controls; lights only. */
  onOpenControls?: () => void;
  /** Overrides the press and hold; null turns it off. */
  onHold?: (() => void) | null;
}

const levelOf = (device: ToggleDevice) => device.kind === "light" ? device.brightness : device.kind === "fan" ? device.speed : 0;
const hasLevel = (device: ToggleDevice) => (device.kind === "light" && device.dimmable) || (device.kind === "fan" && device.adjustable);

export function describeDevice(device: ToggleDevice, shownLevel = levelOf(device)) {
  if (!device.available) return "Unavailable";
  if (!device.on || shownLevel === 0) return "Off";
  return hasLevel(device) ? `${shownLevel}%` : "On";
}

/** Lights, switches, and fans: tap to switch, with a vertical level in the tall and large templates. */
export function ToggleTile({ device, config, onCommand, interactive = true, onOpenControls, onHold }: ToggleTileProps) {
  const [error, setError] = useState<string | null>(null);
  const style = defaultStyle(device);
  const Icon = TILE_ICON_COMPONENTS[config.icon ?? style.icon];
  const color = config.color ?? style.color;
  const disabled = !device.available || !interactive;
  const spin = device.kind === "fan" && device.on ? { "--spin-duration": `${Math.max(0.5, 3 - device.speed / 100 * 2.4)}s` } as CSSProperties : undefined;
  const controls = device.kind === "light" && hasControls(device) && interactive && device.available ? onOpenControls : undefined;
  const press = useLongPress(onHold === undefined ? controls : onHold ?? undefined);
  const tint = device.kind === "light" ? lightTint(device) : null;
  const colorable = device.kind === "light" && (device.supportsColor || device.temperatureRange !== null);

  const run = (command: DeviceCommand) => {
    setError(null);
    return onCommand(command).catch(cause => setError(cause instanceof Error ? cause.message : "The device did not respond."));
  };
  const toggle = () => run({ type: "power", on: !device.on });
  const commitLevel = (value: number) => run(device.kind === "fan" ? { type: "fanSpeed", value } : value === 0 ? { type: "power", on: false } : { type: "brightness", value });

  const icon = (size: number) => (
    <span className={styles.icon} data-spin={spin ? "" : undefined} style={spin} aria-hidden="true">
      <Icon size={size} strokeWidth={1.75} />
    </span>
  );
  const shared = { "data-color": color, "data-unavailable": !device.available || undefined, "data-size": config.size, "data-tinted": tint ? "" : undefined, "data-glow": config.options?.glow || undefined, style: tint ? { "--tile-color": tint } as CSSProperties : undefined };
  const detail = [device.room, config.options?.hideStatus ? null : describeDevice(device)].filter(Boolean).join(" · ");
  const swatch = controls && colorable && (
    <button type="button" className={`${styles.swatch} ${glassClass("pill")}`} onClick={controls} aria-label={`Colour and brightness for ${device.name}`} title="Colour and brightness">
      <span className={styles.swatchDot} style={tint ? { "--swatch": tint } as CSSProperties : undefined} aria-hidden="true" />
    </button>
  );

  if ((config.size === "1x2" || config.size === "2x2") && hasLevel(device)) {
    const label = `${device.name} ${device.kind === "fan" ? "speed" : "brightness"}`;
    if (config.size === "1x2") {
      return (
        <div className={`${glassClass("panel")} ${styles.tile} ${level.tall}`} {...shared} {...press} data-template="slider">
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
      <div className={`${glassClass("panel")} ${styles.tile} ${level.large}`} {...shared} {...press} data-template="large" data-on={device.on || undefined}>
        <button type="button" className={level.largeBody} onClick={toggle} disabled={disabled} aria-pressed={device.on} aria-label={`${device.name}, ${describeDevice(device)}`}>
          <span className={styles.badge}>{icon(24)}</span>
          <span className={styles.text}>
            <span className={styles.name}>{device.name}</span>
            {(error || detail) && <span className={`${styles.meta} ${error ? styles.error : ""}`}>{error ?? detail}</span>}
          </span>
        </button>
        <LevelPill label={label} value={levelOf(device)} on={device.on} disabled={disabled} onToggle={toggle} onCommit={commitLevel} className={level.sidePill} />
        {swatch}
      </div>
    );
  }

  const tile = (
    <button
      type="button"
      className={`${glassClass("panel")} ${styles.tile} ${styles.press}`}
      {...shared}
      {...press}
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
            {(error || detail) && <span className={`${styles.meta} ${error ? styles.error : ""}`}>{error ?? detail}</span>}
          </span>
        </>
      )}
    </button>
  );
  if (!swatch || config.size === "1x1") return tile;
  return <div className={styles.frame}>{tile}{swatch}</div>;
}
