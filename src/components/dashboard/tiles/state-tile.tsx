"use client";

import { LockOpen, Warehouse } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { HoldToConfirm } from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { defaultStyle } from "@/lib/dashboard/style";
import {
  isSensitive, type BinarySensorDevice, type CoverDevice, type DeviceCommand, type EventDevice, type LockDevice, type SceneDevice, type SensorDevice,
} from "@/lib/devices/types";
import type { OpenMethod } from "@/lib/security-types";
import { lookAtDoor } from "../doorbell-call";
import { PinPad } from "../pin-pad";
import { useHome } from "../use-home";
import { LevelPill } from "./level-pill";
import { useHoldToOpen } from "./use-hold-to-open";
import { useLongPress } from "./use-long-press";
import { MiniTrend } from "./mini-trend";
import { TILE_ICON_COMPONENTS } from "./tile-icons";
import styles from "./tile.module.css";
import level from "./level-tile.module.css";
import { LevelOverlay } from "./level-overlay";

export type StateDevice = LockDevice | CoverDevice | BinarySensorDevice | SensorDevice | EventDevice | SceneDevice;

interface StateTileProps {
  device: StateDevice;
  config: TileConfig;
  /** `pin` is the household PIN, when the home confirms opening with one. */
  onCommand: (command: DeviceCommand, pin?: string) => Promise<void>;
  /** How opening this home is confirmed. */
  openMethod?: OpenMethod;
  interactive?: boolean;
  /** Readings open their history when tapped. */
  onOpenHistory?: () => void;
  /** What a press and hold does; null or undefined for nothing. */
  onHold?: (() => void) | null;
}

const LOCK_TEXT: Record<LockDevice["state"], string> = { locked: "Locked", unlocked: "Unlocked", locking: "Locking", unlocking: "Unlocking", jammed: "Jammed", open: "Open", unknown: "Unknown" };
const COVER_TEXT: Record<CoverDevice["state"], string> = { open: "Open", closed: "Closed", opening: "Opening", closing: "Closing", stopped: "Stopped", unknown: "Unknown" };
const BINARY_TEXT: Record<BinarySensorDevice["sensorClass"], [string, string]> = {
  door: ["Open", "Closed"], window: ["Open", "Closed"], garage: ["Open", "Closed"], opening: ["Open", "Closed"],
  motion: ["Motion", "Clear"], occupancy: ["Occupied", "Clear"], leak: ["Leak", "Dry"], smoke: ["Smoke", "Clear"], other: ["On", "Off"],
};

const subscribeMinute = (onChange: () => void) => {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
};
const minute = () => Math.floor(Date.now() / 30_000);

export function relativeTime(iso: string, now: number) {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatReading(device: SensorDevice) {
  if (device.value === null) return "No reading";
  const value = Number.isInteger(device.value) ? device.value : device.value.toFixed(1);
  if (device.sensorClass === "temperature") return `${value}°`;
  return device.unit === "%" ? `${value}%` : `${value}${device.unit ? ` ${device.unit}` : ""}`;
}

/** What the tile says, and whether it is in its noteworthy state (unlocked, open, motion, a recent ring). */
function describe(device: StateDevice, now: number): { text: string; active: boolean } {
  if (!device.available) return { text: "Unavailable", active: false };
  switch (device.kind) {
    case "lock":
      return { text: LOCK_TEXT[device.state], active: device.state !== "locked" && device.state !== "locking" };
    case "cover": {
      const moving = device.state === "opening" || device.state === "closing";
      const partly = device.position !== null && device.position > 0 && device.position < 100 && !moving;
      return { text: partly ? `${device.position}% open` : COVER_TEXT[device.state], active: device.state !== "closed" };
    }
    case "binary_sensor":
      return { text: BINARY_TEXT[device.sensorClass][device.active ? 0 : 1], active: device.active };
    case "sensor":
      return { text: formatReading(device), active: false };
    case "event": {
      if (!device.last) return { text: device.eventClass === "doorbell" ? "No rings yet" : "No presses yet", active: false };
      const recent = now * 30_000 - Date.parse(device.last) < 120_000;
      return { text: `${device.eventClass === "doorbell" ? "Rang" : "Pressed"} ${relativeTime(device.last, now * 30_000)}`, active: recent };
    }
    case "scene":
      return { text: device.variant === "button" ? "Press" : "Run", active: false };
  }
}

/** The command a tap sends, or null for read-only tiles. */
function tapCommand(device: StateDevice): DeviceCommand | null {
  switch (device.kind) {
    case "lock":
      return { type: "lock", locked: device.state !== "locked" && device.state !== "locking" };
    case "cover":
      return { type: "cover", action: device.state === "opening" && device.canStop ? "stop" : device.state === "closed" || device.state === "closing" ? "open" : "close" };
    case "scene":
      return { type: "activate" };
    default:
      return null;
  }
}

/** The word on a tall card's button: what a tap does next. */
function actionWord(command: DeviceCommand) {
  if (command.type === "lock") return command.locked ? "Lock" : "Unlock";
  if (command.type === "cover") return command.action === "open" ? "Open" : command.action === "stop" ? "Stop" : "Close";
  return "Run";
}

const CONFIRM_CLOSE_MS = 700;

function confirmText(device: StateDevice, state: string) {
  const verb = device.kind === "lock" ? "unlock" : "open";
  return {
    title: `${verb === "unlock" ? "Unlock" : "Open"} ${device.name}?`,
    description: `${device.name} is ${state.toLowerCase()}. This opens your home, so hold the button to ${verb} it.`,
    hold: `Hold to ${verb}`,
    done: verb === "unlock" ? "Unlocking" : "Opening",
  };
}

/** The PIN way to open the home: the server checks the PIN, so a wrong one is refused there and shown here. */
function PinConfirm({ device, state, onPin, onClose }: { device: StateDevice; state: string; onPin: (pin: string) => Promise<string | null>; onClose: () => void }) {
  const verb = device.kind === "lock" ? "Unlock" : "Open";
  const { home } = useHome();
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className={glassSheetClass} title={`${verb} ${device.name}?`} description={`${device.name} is ${state.toLowerCase()}. Enter the household PIN to ${verb.toLowerCase()} it.`}>
        <PinPad label="Household PIN" submitLabel={verb} length={home?.pinLength} onSubmit={onPin} />
      </DialogContent>
    </Dialog>
  );
}

function SensitiveConfirm({ device, state, onConfirm, onClose }: { device: StateDevice; state: string; onConfirm: () => void; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const text = confirmText(device, state);
  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(onClose, CONFIRM_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [confirmed, onClose]);
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className={glassSheetClass} title={text.title} description={text.description}>
        <div className={styles.confirmActions}>
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <HoldToConfirm
            label={text.hold}
            confirmedLabel={text.done}
            tone="neutral"
            duration={1000}
            confirmed={confirmed}
            icon={device.kind === "lock" ? <LockOpen size={18} strokeWidth={1.75} /> : <Warehouse size={18} strokeWidth={1.75} />}
            onConfirm={() => { setConfirmed(true); onConfirm(); }}
            autoFocus
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StateTile({ device, config, onCommand, interactive = true, onOpenHistory, onHold, openMethod = "hold" }: StateTileProps) {
  const now = useSyncExternalStore(subscribeMinute, minute, () => 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<DeviceCommand | null>(null);
  const [ran, setRan] = useState(false);
  const style = defaultStyle(device);
  const Icon = TILE_ICON_COMPONENTS[config.icon ?? style.icon];
  const color = config.color ?? style.color;
  const { text, active } = describe(device, now);
  const command = tapCommand(device);
  const disabled = !device.available || !interactive || !command;

  useEffect(() => {
    if (!ran) return;
    const timer = setTimeout(() => setRan(false), 2000);
    return () => clearTimeout(timer);
  }, [ran]);

  const run = (next: DeviceCommand) => {
    setError(null);
    return onCommand(next).then(() => device.kind === "scene" && setRan(true), cause => setError(cause instanceof Error ? cause.message : "The device did not respond."));
  };
  const request = (next: DeviceCommand) => isSensitive(device, next) ? setPending(next) : run(next);
  const holdToOpen = Boolean(command && !disabled && openMethod === "hold" && isSensitive(device, command));
  const hold = useHoldToOpen(holdToOpen, () => { if (command) void run(command); });
  const holdWords = command ? `${actionWord(command)}` : "";

  const press = useLongPress(holdToOpen ? undefined : onHold ?? undefined);
  const shared = {
    "data-color": color, "data-unavailable": !device.available || undefined, "data-size": config.size, "data-template": "toggle", "data-on": active || undefined, "data-glow": config.options?.glow || undefined,
    "data-holding": hold.holding || undefined, ...press,
  };
  const holdMeta = hold.holding ? "Keep holding" : hold.hint ? `Hold to ${holdWords.toLowerCase()}` : null;
  const meta = error ?? holdMeta ?? (ran ? "Done" : [device.room && config.size !== "1x1" ? device.room : null, config.options?.hideStatus && device.kind !== "sensor" ? null : text].filter(Boolean).join(" · "));
  const fill = holdToOpen && <span className={styles.holdFill} aria-hidden="true" />;
  const isReading = device.kind === "sensor";
  const confirm = pending && (openMethod === "pin"
    ? <PinConfirm device={device} state={text} onClose={() => setPending(null)} onPin={pin => onCommand(pending, pin).then(() => { setPending(null); return null; }, cause => cause instanceof Error ? cause.message : "That did not work.")} />
    : <SensitiveConfirm device={device} state={text} onConfirm={() => run(pending)} onClose={() => setPending(null)} />);

  if (device.kind === "cover" && device.canSetPosition && (config.size === "1x2" || config.size === "2x2")) {
    const commit = async (value: number) => { await request({ type: "coverPosition", value }); };
    const toggle = () => request(tapCommand(device) as DeviceCommand);
    const pill = (className: string) => (
      <LevelPill label={`${device.name} position`} value={device.position ?? 0} on={(device.position ?? 0) > 0} disabled={!device.available || !interactive} onToggle={toggle} onCommit={commit} className={className}>
        {config.size === "1x2" ? shown => (
          <LevelOverlay shown={shown}>
            <span className={level.reading}>{shown === 0 ? "Closed" : `${shown}%`}</span>
            <span className={level.foot}>
              <span className={styles.icon} aria-hidden="true"><Icon size={22} strokeWidth={1.75} /></span>
              <span className={styles.name}>{device.name}</span>
            </span>
          </LevelOverlay>
        ) : undefined}
      </LevelPill>
    );
    return (
      <>
        {config.size === "1x2" ? (
          <div className={`${glassClass("panel")} ${styles.tile} ${level.tall}`} {...shared} data-template="slider" data-on={undefined}>{pill(level.fullPill)}</div>
        ) : (
          <div className={`${glassClass("panel")} ${styles.tile} ${level.large}`} {...shared} data-template="large">
            <button type="button" className={level.largeBody} onClick={toggle} disabled={disabled} data-haptic aria-label={`${device.name}, ${text}`}>
              <span className={styles.badge}><span className={styles.icon} aria-hidden="true"><Icon size={24} strokeWidth={1.75} /></span></span>
              <span className={styles.text}>
                <span className={styles.name}>{device.name}</span>
                <span className={`${styles.meta} ${error ? styles.error : ""}`}>{meta}</span>
              </span>
            </button>
            {pill(level.sidePill)}
          </div>
        )}
        {confirm}
      </>
    );
  }

  if ((device.kind === "lock" || device.kind === "cover") && (config.size === "1x2" || config.size === "2x2") && command) {
    const large = config.size === "2x2";
    return (
      <>
        <div className={`${glassClass("panel")} ${styles.tile} ${styles.tall}`} {...shared}>
          <span className={styles.tallTop}>
            <span className={styles.tallBadge}><span className={styles.icon} aria-hidden="true"><Icon size={large ? 30 : 26} strokeWidth={1.75} /></span></span>
          </span>
          {fill}
          <span className={styles.tallText}>
            <span className={styles.tallState}>{error ? "Try again" : text}</span>
            <span className={styles.name}>{device.name}</span>
            {(holdMeta ?? device.room) && <span className={styles.meta}>{holdMeta ?? device.room}</span>}
          </span>
          <button type="button" className={styles.tallAction} disabled={disabled} onClick={() => { if (!hold.justOpened()) void request(command); }} {...hold.handlers}
            aria-label={holdToOpen ? `Hold to ${actionWord(command).toLowerCase()} ${device.name}` : `${actionWord(command)} ${device.name}`}>{actionWord(command)}</button>
        </div>
        {confirm}
      </>
    );
  }

  const charted = isReading && onOpenHistory && interactive;
  const door = device.kind === "event" && device.eventClass === "doorbell" && interactive && device.available;
  const Root = command || charted || door ? "button" : "div";
  return (
    <>
      <Root
        {...(command ? { type: "button" as const, onClick: () => { if (!hold.justOpened()) void request(command); }, disabled, "aria-label": `${device.name}${device.room ? ` in ${device.room}` : ""}, ${text}${holdToOpen ? `. Hold to ${holdWords.toLowerCase()}` : ""}` }
          : charted ? { type: "button" as const, onClick: onOpenHistory, "aria-label": `${device.name}, ${text}. Show history` }
          : door ? { type: "button" as const, onClick: () => lookAtDoor(device.id), "aria-label": `${device.name}, ${text}. Look at the door` }
            : { role: "group", "aria-label": `${device.name}, ${text}` })}
        className={`${glassClass("panel")} ${styles.tile} ${styles.press} ${isReading ? styles.reading : ""}`}
        {...shared}
        {...hold.handlers}
        title={error ?? undefined}
      >
        {fill}
        {config.size === "1x1" ? (
          <>
            {isReading ? <span className={styles.value}>{text}</span> : <span className={styles.icon} aria-hidden="true"><Icon size={28} strokeWidth={1.75} /></span>}
            <span className={styles.name}>{holdMeta ?? device.name}</span>
            {!isReading && !holdMeta && <span className={styles.status}>{error ?? text}</span>}
          </>
        ) : (
          <>
            <span className={styles.badge}><span className={styles.icon} aria-hidden="true"><Icon size={22} strokeWidth={1.75} /></span></span>
            <span className={styles.text}>
              <span className={styles.name}>{device.name}</span>
              <span className={`${styles.meta} ${error ? styles.error : ""}`}>{meta}</span>
            </span>
            {isReading && <MiniTrend deviceId={device.id} />}
          </>
        )}
      </Root>
      {confirm}
    </>
  );
}
