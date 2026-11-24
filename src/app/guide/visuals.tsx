"use client";

import { BellRing, Clapperboard, DoorClosed, Fan, Lamp, Lightbulb, Lock, LogOut, MonitorPause, Moon, Paintbrush, Plug, Radar, Settings, Thermometer, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { RestPreview } from "@/components/shell/rest-preview";
import { CLOCK_FACES, DEFAULT_WALL, type ClockFace, type WallSettings } from "@/lib/wall";
import styles from "./guide.module.css";

const face: WallSettings = { ...DEFAULT_WALL, clockBrightness: 1, secondHand: "smooth" };
const FACE_LOOKS: Partial<Record<ClockFace, Partial<WallSettings>>> = { digital: { digitLayout: "stacked" }, analog: { clockColor: "blue" }, luxury: { clockColor: "green" }, words: { clockColor: "warm" } };

const Row = ({ icon, title, meta, end }: { icon: ReactNode; title: string; meta?: string; end?: ReactNode }) => (
  <div className={styles.row}>
    <span className={styles.rowIcon} aria-hidden="true">{icon}</span>
    <span className={styles.rowText}><span className={styles.rowTitle}>{title}</span>{meta && <span className={styles.rowMeta}>{meta}</span>}</span>
    {end}
  </div>
);

const Toggle = ({ on = true }: { on?: boolean }) => <span className={styles.toggle} data-on={on || undefined} aria-hidden="true" />;

export function ConnectVisual() {
  return (
    <div className={styles.panel}>
      <Row icon={<Plug size={18} strokeWidth={1.75} />} title="Home Assistant" meta="homeassistant.local:8123" end={<span className={styles.badge}>38 devices</span>} />
      <div className={styles.field}><span className={styles.fieldLabel}>Long-lived access token</span><span className={styles.fieldValue}>•••••••••••••••••••••••</span></div>
    </div>
  );
}

export function ArrangeVisual() {
  const tiles: [ReactNode, string, string][] = [[<Lightbulb key="l" size={18} strokeWidth={1.75} />, "Floor lamp", "45%"], [<Lock key="k" size={18} strokeWidth={1.75} />, "Front door", "Locked"], [<Thermometer key="t" size={18} strokeWidth={1.75} />, "Living room", "22°"], [<Clapperboard key="c" size={18} strokeWidth={1.75} />, "Evening", "Run"], [<Fan key="f" size={18} strokeWidth={1.75} />, "Ceiling fan", "40%"], [<Lamp key="p" size={18} strokeWidth={1.75} />, "Porch light", "Off"]];
  return (
    <div className={styles.grid}>
      {tiles.map(([icon, name, state], index) => (
        <span key={name} className={styles.tile} data-wobble={index % 2 ? "b" : "a"}>
          <span className={styles.tileIcon} aria-hidden="true">{icon}</span>
          <span className={styles.rowTitle}>{name}</span>
          <span className={styles.rowMeta}>{state}</span>
        </span>
      ))}
    </div>
  );
}

export function WallVisual() {
  return (
    <div className={styles.panel}>
      <Row icon={<Settings size={18} strokeWidth={1.75} />} title="Use this screen as a wall tablet" meta="Hides the menus, keeps the screen awake, dims at night" end={<Toggle />} />
      <Row icon={<MonitorPause size={18} strokeWidth={1.75} />} title="Rest after" meta="5 min" />
      <Row icon={<Moon size={18} strokeWidth={1.75} />} title="Night from 22:30 until 07:00" />
    </div>
  );
}

export function FacesVisual() {
  return (
    <div className={styles.faces}>
      {CLOCK_FACES.map(({ value, label }) => (
        <figure key={value} className={styles.face}>
          <RestPreview settings={{ ...face, clockFace: value, ...FACE_LOOKS[value] }} />
          <figcaption>{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function WakeVisual() {
  const actions: [ReactNode, string][] = [[<Paintbrush key="p" size={18} strokeWidth={1.75} />, "Customize"], [<Settings key="s" size={18} strokeWidth={1.75} />, "Settings"], [<Moon key="m" size={18} strokeWidth={1.75} />, "Good night"], [<MonitorPause key="r" size={18} strokeWidth={1.75} />, "Rest"], [<LogOut key="l" size={18} strokeWidth={1.75} />, "Leave"]];
  return (
    <div className={styles.panel}>
      <Row icon={<Radar size={18} strokeWidth={1.75} />} title="Hallway motion" meta="Wakes the screen" end={<Toggle />} />
      <Row icon={<BellRing size={18} strokeWidth={1.75} />} title="Doorbell" meta="Shows the camera" end={<Toggle />} />
      <div className={styles.actions}>{actions.map(([icon, label]) => <span key={label} className={styles.action}><span className={styles.actionIcon} aria-hidden="true">{icon}</span>{label}</span>)}</div>
    </div>
  );
}

export function GoodNightVisual() {
  return (
    <div className={styles.panel}>
      <Row icon={<Lock size={18} strokeWidth={1.75} />} title="Locks" end={<span className={styles.choice}>Lock them</span>} />
      <Row icon={<Warehouse size={18} strokeWidth={1.75} />} title="Garage doors and gates" end={<span className={styles.choice}>Close them</span>} />
      <Row icon={<Lightbulb size={18} strokeWidth={1.75} />} title="Lights" end={<span className={styles.choice}>Turn off</span>} />
      <Row icon={<DoorClosed size={18} strokeWidth={1.75} />} title="Windows and doors" end={<span className={styles.choice}>Check</span>} />
    </div>
  );
}
