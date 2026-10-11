"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Fan, Lightbulb, Plug } from "lucide-react";
import { useState } from "react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import { glassClass } from "@/components/glass/glass";
import type { DeviceCommand, FanDevice, LightDevice, SwitchDevice } from "@/lib/devices/types";
import styles from "./device-tile.module.css";

type TileDevice = LightDevice | SwitchDevice | FanDevice;

interface DeviceTileProps {
  device: TileDevice;
  onCommand: (command: DeviceCommand) => Promise<void>;
}

function describe(device: TileDevice, level: number) {
  if (!device.available) return "Unavailable";
  if (!device.on) return "Off";
  if ((device.kind === "light" && device.dimmable) || (device.kind === "fan" && device.adjustable)) return `On · ${level}%`;
  return "On";
}

export function DeviceTile({ device, onCommand }: DeviceTileProps) {
  const reduce = useReducedMotion();
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<number | null>(null);

  const run = (command: DeviceCommand) => {
    setError(null);
    onCommand(command).catch(cause => setError(cause instanceof Error ? cause.message : "The device did not respond."));
  };

  const adjustable = device.on && device.available && ((device.kind === "light" && device.dimmable) || (device.kind === "fan" && device.adjustable));
  const value = level ?? (device.kind === "light" ? device.brightness : device.kind === "fan" ? device.speed : 0);
  const Icon = device.kind === "light" ? Lightbulb : device.kind === "fan" ? Fan : Plug;
  const spin = device.kind === "fan" && device.on && !reduce ? { animationDuration: `${Math.max(0.5, 3 - (device.speed / 100) * 2.4)}s` } : undefined;

  return (
    <article className={`${glassClass("panel")} ${styles.tile}`} data-on={device.on || undefined} data-unavailable={!device.available || undefined} aria-labelledby={`${device.id}-label`}>
      <div className={styles.top}>
        <span className={styles.icon} data-spin={spin ? "" : undefined} style={spin} aria-hidden="true">
          <Icon size={22} strokeWidth={1.75} />
        </span>
        <Switch aria-label={`${device.name} power`} checked={device.on} disabled={!device.available} onCheckedChange={on => run({ type: "power", on })} />
      </div>
      <div className={styles.text}>
        <h3 id={`${device.id}-label`} className={styles.name}>{device.name}</h3>
        <p className={styles.state}>{error ?? describe(device, value)}</p>
      </div>
      <AnimatePresence initial={false}>
        {adjustable && (
          <motion.div
            key="level"
            className={styles.level}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
            transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
          >
            <Slider
              label={device.kind === "light" ? "Brightness" : "Speed"}
              showValue={false}
              min={device.kind === "light" ? 1 : 0}
              max={100}
              value={value}
              onValueChange={next => setLevel(next)}
              onValueCommit={next => {
                setLevel(null);
                run(device.kind === "light" ? { type: "brightness", value: next } : { type: "fanSpeed", value: next });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
