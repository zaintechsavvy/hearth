"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ColorPicker } from "@/components/arc/color-picker/color-picker";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import { glassSheetClass } from "@/components/glass/glass";
import { hexToHs, hsToHex, kelvinToHex } from "@/lib/devices/color";
import { clamp, type DeviceCommand, type LightDevice } from "@/lib/devices/types";
import styles from "./light-controls.module.css";

const PRESETS: { name: string; hex: string }[] = [
  { name: "Candle", hex: "#ff9a3c" }, { name: "Sunset", hex: "#ff6a3d" }, { name: "Rose", hex: "#ff4f7b" }, { name: "Magenta", hex: "#e64fd0" },
  { name: "Violet", hex: "#8b5cf6" }, { name: "Ocean", hex: "#3b82f6" }, { name: "Sky", hex: "#38bdf8" }, { name: "Teal", hex: "#14b8a6" },
  { name: "Lime", hex: "#84cc16" }, { name: "Forest", hex: "#22c55e" }, { name: "Gold", hex: "#facc15" }, { name: "Red", hex: "#ef4444" },
];
const WHITES = [{ name: "Warm", kelvin: 2700 }, { name: "Soft", kelvin: 3000 }, { name: "Neutral", kelvin: 4000 }, { name: "Daylight", kelvin: 5500 }, { name: "Cool", kelvin: 6500 }];
const SEND_DELAY_MS = 220;

/** The current glow of a light, for tinting its tile and the controls, or null when it is off or plain. */
export function lightTint(device: LightDevice) {
  if (!device.on) return null;
  if (device.colorMode === "color" && device.color) return hsToHex({ hue: device.color.hue, saturation: Math.max(device.color.saturation, 35) });
  if (device.colorMode === "white" && device.temperature) return kelvinToHex(device.temperature);
  return null;
}

export const hasControls = (device: LightDevice) => device.supportsColor || device.temperatureRange !== null || device.dimmable;

interface LightControlsProps {
  device: LightDevice | null;
  onOpenChange: (open: boolean) => void;
  onCommand: (device: LightDevice, command: DeviceCommand) => Promise<void>;
}

/** Brightness, colour, and white temperature for one light, sent as the person settles on a value. */
export function LightControls({ device, onOpenChange, onCommand }: LightControlsProps) {
  return (
    <Dialog open={Boolean(device)} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={device?.name ?? "Light"} description={device?.room ?? "Colour and brightness"}>
        {device && <Body key={device.id} device={device} onCommand={command => onCommand(device, command)} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ device, onCommand }: { device: LightDevice; onCommand: (command: DeviceCommand) => Promise<void> }) {
  const both = device.supportsColor && device.temperatureRange !== null;
  const [mode, setMode] = useState<"color" | "white">(device.colorMode ?? (device.supportsColor ? "color" : "white"));
  const [hex, setHex] = useState(device.color ? hsToHex(device.color) : "#ff9a3c");
  const range = device.temperatureRange;
  const [kelvin, setKelvin] = useState(device.temperature ?? (range ? clamp(2700, range.min, range.max) : 2700));
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const later = (command: DeviceCommand) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void onCommand(command), SEND_DELAY_MS);
  };
  const chooseColor = (next: string, now = false) => {
    const color = hexToHs(next.slice(0, 7));
    if (!color) return;
    setHex(next.slice(0, 7));
    setMode("color");
    if (now) void onCommand({ type: "color", ...color });
    else later({ type: "color", ...color });
  };
  const chooseWhite = (next: number, now = false) => {
    if (!range) return;
    const value = clamp(Math.round(next), range.min, range.max);
    setKelvin(value);
    setMode("white");
    if (now) void onCommand({ type: "temperature", kelvin: value });
    else later({ type: "temperature", kelvin: value });
  };

  const glow = !device.on ? "transparent" : mode === "color" && device.supportsColor ? hex : kelvinToHex(kelvin);
  return (
    <div className={styles.body} style={{ "--glow": glow } as CSSProperties}>
      <div className={styles.header}>
        <span className={styles.orb} data-on={device.on || undefined} aria-hidden="true" />
        <span className={styles.status}>{device.on ? (device.dimmable ? `On · ${device.brightness}%` : "On") : "Off"}</span>
        <Switch label="Power" checked={device.on} onCheckedChange={on => void onCommand({ type: "power", on })} />
      </div>

      {device.dimmable && (
        <Slider label="Brightness" value={device.on ? device.brightness : 0} min={0} max={100} format={value => `${value}%`}
          onValueCommit={value => void onCommand(value === 0 ? { type: "power", on: false } : { type: "brightness", value })} />
      )}

      {both && (
        <SegmentedControl label="Light" value={mode} onValueChange={value => setMode(value as "color" | "white")} options={[{ value: "color", label: "Colour" }, { value: "white", label: "White" }]} />
      )}

      {device.supportsColor && mode === "color" && (
        <section className={styles.section} aria-label="Colour">
          <div className={styles.presets} role="radiogroup" aria-label="Colour presets">
            {PRESETS.map(preset => (
              <button key={preset.hex} type="button" role="radio" aria-checked={hex.toLowerCase() === preset.hex} aria-label={preset.name} title={preset.name}
                className={styles.preset} style={{ "--swatch": preset.hex } as CSSProperties} onClick={() => chooseColor(preset.hex, true)} />
            ))}
          </div>
          <ColorPicker label="Any colour" value={hex} onValueChange={value => chooseColor(value)} defaultFormat="hex" />
        </section>
      )}

      {range && mode === "white" && (
        <section className={styles.section} aria-label="White">
          <div className={styles.whites} role="radiogroup" aria-label="White presets">
            {WHITES.filter(white => white.kelvin >= range.min - 200 && white.kelvin <= range.max + 200).map(white => {
              const value = clamp(white.kelvin, range.min, range.max);
              return (
                <button key={white.name} type="button" role="radio" aria-checked={Math.abs(kelvin - value) < 100} className={styles.white} onClick={() => chooseWhite(value, true)}>
                  <span className={styles.whiteSwatch} style={{ "--swatch": kelvinToHex(value) } as CSSProperties} aria-hidden="true" />
                  <span>{white.name}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.temperature} style={{ "--warm": kelvinToHex(range.min), "--cool": kelvinToHex(range.max) } as CSSProperties}>
            <Slider label="Temperature" value={kelvin} min={range.min} max={range.max} step={50} format={value => `${value} K`}
              onValueChange={value => setKelvin(value)} onValueCommit={value => chooseWhite(value, true)} />
          </div>
        </section>
      )}
    </div>
  );
}
