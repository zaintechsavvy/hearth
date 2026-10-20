"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { Alert } from "@/components/arc/alert/alert";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Select } from "@/components/arc/select/select";
import { useHome } from "@/components/dashboard/use-home";
import { Glass } from "@/components/glass/glass";
import { saveBedtime } from "@/lib/actions";
import { DEFAULT_BEDTIME, switchedForBedtime, type BedtimeChoice, type BedtimeSettings } from "@/lib/bedtime";
import { statusText } from "@/lib/devices/status";
import type { Device } from "@/lib/devices/types";
import styles from "./connections.module.css";
import { SettingsSection } from "./settings-section";

type Choice = { value: BedtimeChoice; label: string };
const CHOICES: { key: "locks" | "doors" | "lights" | "alarm" | "openings"; title: string; meta: string; options: Choice[] }[] = [
  { key: "locks", title: "Locks", meta: "Doors with a smart lock.", options: [{ value: "do", label: "Lock them" }, { value: "check", label: "Only check" }, { value: "skip", label: "Leave alone" }] },
  { key: "doors", title: "Garage doors and gates", meta: "Anything with a motor that opens the home.", options: [{ value: "do", label: "Close them" }, { value: "check", label: "Only check" }, { value: "skip", label: "Leave alone" }] },
  { key: "lights", title: "Lights", meta: "Every light that is on, except the ones turned on below.", options: [{ value: "do", label: "Turn off" }, { value: "skip", label: "Leave on" }] },
  { key: "alarm", title: "Alarm", meta: "Armed for the night, or home when it has no night mode.", options: [{ value: "do", label: "Arm it" }, { value: "check", label: "Only check" }, { value: "skip", label: "Leave alone" }] },
  { key: "openings", title: "Windows and doors", meta: "Sensors on doors and windows, which can only be checked.", options: [{ value: "check", label: "Check" }, { value: "skip", label: "Leave alone" }] },
];

/** What good night does, for the whole household: what it locks, closes, and turns off, what it only checks, and what it never touches. */
export function BedtimeSection({ owner }: { owner: boolean }) {
  const { home } = useHome();
  const { mutate } = useSWRConfig();
  const [draft, setDraft] = useState<BedtimeSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const settings = draft ?? home?.bedtime ?? DEFAULT_BEDTIME;
  const devices = home?.devices ?? [];
  const set = async (patch: Partial<BedtimeSettings>) => {
    const next = { ...settings, ...patch };
    setDraft(next);
    const result = await saveBedtime(next);
    setError(result.ok ? null : result.error);
    if (result.ok) await mutate("/api/home");
    setDraft(null);
  };
  const switched = switchedForBedtime(devices);
  const keepable = devices.filter(device => !device.auxiliary && ["lock", "cover", "light", "switch", "fan", "alarm", "binary_sensor"].includes(device.kind)
    && (device.kind !== "cover" || ["garage", "gate", "door"].includes(device.coverClass))
    && (device.kind !== "binary_sensor" || ["door", "window", "garage", "opening"].includes(device.sensorClass)));

  return (
    <SettingsSection id="bedtime" title="Good night" description={<>What one hold of Good night does, for everyone in the home.</>}>
      <Glass shape="panel" className={styles.group}>
        <fieldset disabled={!owner} className={styles.fieldset}>
        {CHOICES.map(choice => (
          <div key={choice.key} className={`${styles.row} ${styles.choiceRow}`}>
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>{choice.title}</span>
              <span className={styles.rowMeta}>{choice.meta}</span>
            </div>
            <SegmentedControl label={choice.title} value={settings[choice.key]}
              onValueChange={value => void set({ [choice.key]: value } as Partial<BedtimeSettings>)} options={choice.options} />
          </div>
        ))}
        <DeviceList title="Also turn on" meta="A porch light or a night light, turned on for the night." ids={settings.turnOn} devices={switched} disabled={!owner}
          onChange={turnOn => void set({ turnOn, turnOff: settings.turnOff.filter(id => !turnOn.includes(id)) })} />
        <DeviceList title="Also turn off" meta="Switches and fans, as well as the lights." ids={settings.turnOff} devices={switched.filter(device => device.kind !== "light" || settings.lights === "skip")} disabled={!owner}
          onChange={turnOff => void set({ turnOff, turnOn: settings.turnOn.filter(id => !turnOff.includes(id)) })} />
        <DeviceList title="Never touch" meta="Left exactly as they are, and never reported." ids={settings.keep} devices={keepable} disabled={!owner} onChange={keep => void set({ keep })} />
        {!owner && <div className={styles.row}><span className={styles.rowMeta}>Only the owner can change this.</span></div>}
        </fieldset>
      </Glass>
      <Alert tone="danger" title="Could not save" open={Boolean(error)}>{error ?? ""}</Alert>
    </SettingsSection>
  );
}

function DeviceList({ title, meta, ids, devices, disabled, onChange }: { title: string; meta: string; ids: string[]; devices: Device[]; disabled: boolean; onChange: (ids: string[]) => void }) {
  const byId = new Map(devices.map(device => [device.id, device]));
  const chosen = ids.filter(id => byId.has(id));
  const left = devices.filter(device => !ids.includes(device.id));
  return (
    <div className={`${styles.row} ${styles.stacked} ${styles.listRow}`}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowMeta}>{meta}</span>
      </div>
      {chosen.length > 0 && (
        <ul className={styles.chips} aria-label={title}>
          {chosen.map(id => {
            const device = byId.get(id) as Device;
            return (
              <li key={id} className={styles.chip}>
                <span>{device.name}<span className={styles.chipRoom}>{[device.room, statusText(device)].filter(Boolean).map(part => ` · ${part}`).join("")}</span></span>
                <button type="button" className={styles.chipRemove} disabled={disabled} onClick={() => onChange(ids.filter(item => item !== id))} aria-label={`Take ${device.name} off ${title.toLowerCase()}`}>
                  <X size={14} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {left.length > 0 && !disabled && (
        <Select label={`Add to ${title.toLowerCase()}`} placeholder="Choose a device" value="" onValueChange={id => id && onChange([...ids, id])}
          options={left.map(device => ({ value: device.id, label: [device.name, device.room, statusText(device)].filter(Boolean).join(" · ") }))} />
      )}
    </div>
  );
}
