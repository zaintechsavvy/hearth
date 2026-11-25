"use client";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Switch } from "@/components/arc/switch/switch";
import type { Device } from "@/lib/devices/types";
import type { WallSettings } from "@/lib/wall";
import { entryMoments, momentKind, momentModeOf, type MomentMode } from "@/lib/wall-moments";
import styles from "./connections.module.css";
import { DeviceChecklist } from "./device-checklist";

const KIND_WORDS = { light: "Light", fan: "Fan", lock: "Lock", garage: "Garage door", door: "Door", window: "Window" } as const;

const MEANING: Record<MomentMode, string> = {
  all: "A light, fan, lock, door, window, or garage door changed somewhere else plays a short scene across the screen.",
  chosen: "Only the devices ticked below play a scene across the screen.",
  off: "Changes stay on their tiles and never take over the screen.",
};

/** Which device changes take over the wall tablet with a full-screen moment, when, and whether a doorbell ring does. */
export function MomentSettings({ settings, set, devices }: { settings: WallSettings; set: (patch: Partial<WallSettings>) => void; devices: Device[] }) {
  const mode = momentModeOf(settings.moments);
  const items = devices.flatMap(device => {
    const kind = momentKind(device);
    return kind ? [{ id: device.id, name: device.name, room: device.room, detail: KIND_WORDS[kind] }] : [];
  });
  const choose = (next: MomentMode) => set(next === "chosen" && settings.momentDevices.length === 0 ? { moments: next, momentDevices: entryMoments(devices) } : { moments: next });

  return (
    <div className={`${styles.row} ${styles.stacked}`}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>Full-screen moments</span>
        <span className={styles.rowMeta}>{MEANING[mode]} Dimmed at night. A water leak always shows, and the doorbell has its own switch.</span>
      </div>
      <SegmentedControl label="Full-screen moments" value={mode} onValueChange={value => choose(value as MomentMode)}
        options={[{ value: "all", label: "Every device" }, { value: "chosen", label: "Chosen devices" }, { value: "off", label: "Off" }]} />
      {mode !== "off" && (
        <Switch label="Also while the screen rests" checked={settings.momentsResting} onCheckedChange={momentsResting => set({ momentsResting })} />
      )}
      {mode === "chosen" && <DeviceChecklist label="Devices with moments" items={items} chosen={settings.momentDevices} onChange={momentDevices => set({ momentDevices })} />}
      <Switch label="Doorbell rings wake the screen and show the camera" checked={settings.doorbellCall} onCheckedChange={doorbellCall => set({ doorbellCall })} />
    </div>
  );
}
