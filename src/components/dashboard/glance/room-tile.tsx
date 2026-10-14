"use client";

import { DoorOpen, Lightbulb, Music, PersonStanding } from "lucide-react";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Device, DeviceCommand, LightDevice } from "@/lib/devices/types";
import styles from "./glance.module.css";

interface RoomTileProps {
  tile: TileConfig;
  devices: Device[];
  rooms: string[];
  interactive: boolean;
  onPick: (room: string) => void;
  onOpen: (room: string) => void;
  onCommand: (device: Device, command: DeviceCommand) => Promise<void>;
}

/** One room at a glance: how warm it is, lights on, doors and windows open, and someone moving, with lights off in one tap. */
export function RoomTile({ tile, devices, rooms, interactive, onPick, onOpen, onCommand }: RoomTileProps) {
  const room = tile.options?.room;
  if (!room || !rooms.includes(room)) {
    return (
      <section className={`${glassClass("panel")} ${styles.tile}`} aria-label="Pick a room">
        <span className={styles.title}>Which room?</span>
        <div className={styles.chips}>{rooms.slice(0, 8).map(name => <button key={name} type="button" className={styles.chip} disabled={!interactive} onClick={() => onPick(name)}>{name}</button>)}</div>
      </section>
    );
  }
  const here = devices.filter(device => device.room === room && device.available);
  const temperature = here.find(device => device.kind === "sensor" && device.sensorClass === "temperature")
    ?? here.find(device => device.kind === "thermostat");
  const degrees = temperature?.kind === "sensor" ? temperature.value : temperature?.kind === "thermostat" ? temperature.current : null;
  const humidity = here.find(device => device.kind === "sensor" && device.sensorClass === "humidity");
  const lights = here.filter((device): device is LightDevice => device.kind === "light" && device.on);
  const open = here.filter(device => device.kind === "binary_sensor" && ["door", "window", "garage", "opening"].includes(device.sensorClass) && device.active);
  const moving = here.some(device => device.kind === "binary_sensor" && (device.sensorClass === "motion" || device.sensorClass === "occupancy") && device.active);
  const playing = here.find(device => device.kind === "media_player" && device.state === "playing");
  const name = tile.label?.trim() || room;
  return (
    <section className={`${glassClass("panel")} ${styles.tile} ${styles.room}`} data-size={tile.size} aria-label={name}>
      <button type="button" className={styles.roomHead} disabled={!interactive} onClick={() => onOpen(room)} aria-label={`Show ${room}`}>
        <span className={styles.text}>
          <span className={styles.title}>{name}</span>
          <span className={styles.meta}>{[humidity?.kind === "sensor" && humidity.value !== null ? `${Math.round(humidity.value)}% humidity` : null, moving ? "Someone is here" : null].filter(Boolean).join(" · ") || `${here.length} devices`}</span>
        </span>
        {degrees !== null && degrees !== undefined && <span className={styles.big}>{Number.isInteger(degrees) ? degrees : degrees.toFixed(1)}°</span>}
      </button>
      <div className={styles.chips}>
        {lights.length > 0 && (
          <button type="button" className={styles.chip} data-on disabled={!interactive} onClick={() => { for (const light of lights) void onCommand(light, { type: "power", on: false }).catch(() => {}); }} aria-label={`Turn off ${lights.length} lights in ${room}`}>
            <Lightbulb size={14} strokeWidth={1.75} aria-hidden="true" />{lights.length} on
          </button>
        )}
        {open.map(device => <span key={device.id} className={styles.chip} data-warn><DoorOpen size={14} strokeWidth={1.75} aria-hidden="true" />{device.name.replace(new RegExp(`^${room}\\s*`, "i"), "") || device.name} open</span>)}
        {moving && tile.size === "2x2" && <span className={styles.chip}><PersonStanding size={14} strokeWidth={1.75} aria-hidden="true" />Motion</span>}
        {playing?.kind === "media_player" && <span className={styles.chip}><Music size={14} strokeWidth={1.75} aria-hidden="true" />{playing.title ?? "Playing"}</span>}
        {lights.length === 0 && open.length === 0 && !playing && <span className={styles.meta}>All quiet</span>}
      </div>
    </section>
  );
}
