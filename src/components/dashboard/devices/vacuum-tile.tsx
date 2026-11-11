"use client";

import { Check, CircleDot, House, Locate, MoreHorizontal, Pause, Play, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { statusText } from "@/lib/devices/status";
import type { DeviceCommand, VacuumDevice } from "@/lib/devices/types";
import { OptionChips } from "../option-chips";
import styles from "./device-tiles.module.css";

type Run = (command: DeviceCommand) => void;
const RING = 2 * Math.PI * 46;

/**
 * A robot vacuum. Every size offers the same things: start or pause, send it home, find it, clean a spot, clean
 * chosen rooms, and set its suction, each where the vacuum supports it. The large card lays the main ones out
 * around a start button ringed by the battery; the small one opens them all in a sheet.
 */
export function VacuumTile({ device, config, interactive, onCommand }: { device: VacuumDevice; config: TileConfig; interactive: boolean; onCommand: (command: DeviceCommand) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const cleaning = device.state === "cleaning";
  const disabled = !interactive || !device.available;
  const send: Run = command => { setError(null); void onCommand(command).catch(cause => setError(cause instanceof Error ? cause.message : "The vacuum did not answer.")); };
  const name = config.label?.trim() || device.name;
  const go = cleaning ? device.can.pause : device.can.start;
  const toggle = () => send({ type: "vacuum", action: cleaning ? "pause" : "start" });
  const head = (end?: ReactNode) => (
    <div className={styles.head}>
      <span className={styles.badge} data-spin={cleaning || undefined} aria-hidden="true"><CircleDot size={20} strokeWidth={1.75} /></span>
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{error ?? statusText(device)}</span>
      </span>
      {end}
    </div>
  );
  const card = { className: `${glassClass("panel")} ${styles.card}`, "data-size": config.size, "data-active": cleaning || undefined, "data-alert": device.state === "error" || undefined };

  if (config.size !== "2x2") {
    return (
      <VacuumSheet device={device} disabled={disabled} send={send} trigger={
        <button type="button" {...card} disabled={disabled} aria-label={`${device.name}, ${statusText(device)}. Show its controls`}>
          {head(
            <span className={styles.headEnd}>
              <span className={styles.round} aria-hidden="true"><MoreHorizontal size={16} strokeWidth={1.75} /></span>
            </span>,
          )}
        </button>
      } />
    );
  }

  const battery = device.battery ?? 0;
  return (
    <section {...card} data-template="vacuum" aria-label={`${device.name}, ${statusText(device)}`}>
      {head()}
      <div className={styles.vacuumCenter}>
        {go && (
          <button type="button" className={styles.vacuumGo} disabled={disabled} aria-label={cleaning ? "Pause" : "Start cleaning"} onClick={toggle}>
            {device.battery !== null && (
              <svg viewBox="0 0 100 100" className={styles.vacuumRing} aria-hidden="true">
                <circle cx="50" cy="50" r="46" className={styles.ringTrack} />
                <circle cx="50" cy="50" r="46" className={styles.ringFill} data-low={battery < 20 || undefined} strokeDasharray={RING} strokeDashoffset={RING * (1 - battery / 100)} />
              </svg>
            )}
            {cleaning ? <Pause size={26} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Play size={26} strokeWidth={0} fill="currentColor" className={styles.playNudge} aria-hidden="true" />}
          </button>
        )}
      </div>
      <div className={styles.vacuumRow}>
        {device.can.dock && <RoundAction label="Dock" disabled={disabled || device.state === "docked"} onClick={() => send({ type: "vacuum", action: "dock" })}><House size={17} strokeWidth={1.75} aria-hidden="true" /></RoundAction>}
        {device.can.locate && <RoundAction label="Find" disabled={disabled} onClick={() => send({ type: "vacuum", action: "locate" })}><Locate size={17} strokeWidth={1.75} aria-hidden="true" /></RoundAction>}
        {device.can.spot && <RoundAction label="Spot" disabled={disabled} onClick={() => send({ type: "vacuum", action: "spot" })}><Sparkles size={17} strokeWidth={1.75} aria-hidden="true" /></RoundAction>}
        {(device.can.areas || device.fanSpeeds.length > 0) && (
          <VacuumSheet device={device} disabled={disabled} send={send} trigger={
            <button type="button" className={styles.roundAction} disabled={disabled}>
              <span className={styles.round}><MoreHorizontal size={17} strokeWidth={1.75} aria-hidden="true" /></span>Rooms
            </button>
          } />
        )}
      </div>
    </section>
  );
}

function RoundAction({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={styles.roundAction} disabled={disabled} onClick={onClick}>
      <span className={styles.round}>{children}</span>{label}
    </button>
  );
}

const fetchAreas = (url: string) => fetch(url).then(async response => {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "");
  return (body?.areas ?? []) as { id: string; name: string }[];
});

/** Everything the vacuum can do, in one sheet: the controls, the rooms to clean, and its suction. */
function VacuumSheet({ device, disabled, send, trigger }: { device: VacuumDevice; disabled: boolean; send: Run; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const { data: areas, error } = useSWR(open && device.can.areas ? `/api/devices/${encodeURIComponent(device.id)}/vacuum-areas` : null, fetchAreas, { revalidateOnFocus: false });
  const cleaning = device.state === "cleaning";
  const toggle = (id: string) => setChosen(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const finish = (command: DeviceCommand) => { send(command); setOpen(false); setChosen([]); };
  return (
    <Popover open={open} onOpenChange={next => { if (!disabled) setOpen(next); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className={`${glassSheetClass} ${styles.sheet}`}>
        <div className={styles.sheetActions}>
          {(cleaning ? device.can.pause : device.can.start) && (
            <RoundAction label={cleaning ? "Pause" : "Clean"} disabled={false} onClick={() => finish({ type: "vacuum", action: cleaning ? "pause" : "start" })}>
              {cleaning ? <Pause size={17} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Play size={17} strokeWidth={0} fill="currentColor" aria-hidden="true" />}
            </RoundAction>
          )}
          {device.can.dock && <RoundAction label="Dock" disabled={device.state === "docked"} onClick={() => finish({ type: "vacuum", action: "dock" })}><House size={17} strokeWidth={1.75} aria-hidden="true" /></RoundAction>}
          {device.can.locate && <RoundAction label="Find" disabled={false} onClick={() => send({ type: "vacuum", action: "locate" })}><Locate size={17} strokeWidth={1.75} aria-hidden="true" /></RoundAction>}
          {device.can.spot && <RoundAction label="Spot" disabled={false} onClick={() => finish({ type: "vacuum", action: "spot" })}><Sparkles size={17} strokeWidth={1.75} aria-hidden="true" /></RoundAction>}
        </div>
        {device.can.areas && (
          <div className={styles.sheetGroup}>
            <span className={styles.sheetLabel}>Clean rooms</span>
            {error ? <p className={styles.sheetNote}>{error.message || "The rooms did not load just now."}</p>
              : !areas ? <p className={styles.sheetNote}>Looking up its map…</p>
              : areas.length === 0 ? <p className={styles.sheetNote}>No rooms yet. Map the vacuum&apos;s rooms to your areas in its settings in Home Assistant.</p>
              : (
                <>
                  <div className={styles.roomList}>
                    {areas.map(area => (
                      <button key={area.id} type="button" role="checkbox" aria-checked={chosen.includes(area.id)} className={styles.roomChoice} onClick={() => toggle(area.id)}>
                        <span className={styles.roomTick} aria-hidden="true">{chosen.includes(area.id) && <Check size={13} strokeWidth={2.25} />}</span>{area.name}
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.pill} data-lead disabled={chosen.length === 0} onClick={() => finish({ type: "vacuumAreas", areas: chosen })}>
                    <Play size={16} strokeWidth={1.75} aria-hidden="true" />{chosen.length > 1 ? `Clean ${chosen.length} rooms` : "Clean this room"}
                  </button>
                </>
              )}
          </div>
        )}
        {device.fanSpeeds.length > 0 && <OptionChips label="Suction" value={device.fanSpeed} options={device.fanSpeeds} onChoose={speed => send({ type: "vacuumFanSpeed", speed })} />}
      </PopoverContent>
    </Popover>
  );
}
