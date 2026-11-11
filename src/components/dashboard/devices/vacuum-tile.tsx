"use client";

import { Check, CircleDot, House, Locate, Pause, Play, SlidersHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { statusText } from "@/lib/devices/status";
import type { DeviceCommand, VacuumDevice } from "@/lib/devices/types";
import { OptionChips } from "../option-chips";
import styles from "./device-tiles.module.css";

type Run = (command: DeviceCommand) => void;

/**
 * A robot vacuum: what it is doing and its battery, one tap to start or pause, buttons to send it home or find it,
 * and, for a vacuum that has them, a sheet to clean chosen rooms, clean a spot, or set its suction.
 */
export function VacuumTile({ device, config, interactive, onCommand }: { device: VacuumDevice; config: TileConfig; interactive: boolean; onCommand: (command: DeviceCommand) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const cleaning = device.state === "cleaning";
  const disabled = !interactive || !device.available;
  const send: Run = command => { setError(null); void onCommand(command).catch(cause => setError(cause instanceof Error ? cause.message : "The vacuum did not answer.")); };
  const run = (action: Extract<DeviceCommand, { type: "vacuum" }>["action"]) => send({ type: "vacuum", action });
  const large = config.size === "2x2";
  const more = (device.can.areas || device.can.spot || device.fanSpeeds.length > 0) && <VacuumOptions device={device} disabled={disabled} send={send} />;
  return (
    <section className={`${glassClass("panel")} ${styles.card}`} data-size={config.size} data-active={cleaning || undefined} data-alert={device.state === "error" || undefined} aria-label={`${device.name}, ${statusText(device)}`}>
      <div className={styles.head}>
        <span className={styles.badge} data-spin={cleaning || undefined} aria-hidden="true"><CircleDot size={20} strokeWidth={1.75} /></span>
        <span className={styles.text}>
          <span className={styles.name}>{config.label?.trim() || device.name}</span>
          <span className={styles.meta}>{error ?? statusText(device)}</span>
        </span>
        {!large && (
          <span className={styles.headEnd}>
            {more}
            {(cleaning ? device.can.pause : device.can.start) && (
              <button type="button" className={styles.round} data-lead disabled={disabled} aria-label={cleaning ? "Pause" : "Start cleaning"} onClick={() => run(cleaning ? "pause" : "start")}>
                {cleaning ? <Pause size={16} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Play size={16} strokeWidth={0} fill="currentColor" aria-hidden="true" />}
              </button>
            )}
          </span>
        )}
      </div>
      {large && (
        <>
          {device.battery !== null && (
            <span className={styles.meter} aria-hidden="true"><span style={{ width: `${device.battery}%` }} data-low={device.battery < 20 || undefined} /></span>
          )}
          <div className={styles.actions}>
            {(cleaning ? device.can.pause : device.can.start) && (
              <button type="button" className={styles.pill} data-lead disabled={disabled} onClick={() => run(cleaning ? "pause" : "start")}>
                {cleaning ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}{cleaning ? "Pause" : "Clean"}
              </button>
            )}
            {device.can.dock && <button type="button" className={styles.pill} disabled={disabled || device.state === "docked"} onClick={() => run("dock")}><House size={16} strokeWidth={1.75} aria-hidden="true" />Dock</button>}
            {device.can.locate && <button type="button" className={styles.pill} disabled={disabled} aria-label="Find it" onClick={() => run("locate")}><Locate size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
            {more}
          </div>
        </>
      )}
    </section>
  );
}

const fetchAreas = (url: string) => fetch(url).then(async response => {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "");
  return (body?.areas ?? []) as { id: string; name: string }[];
});

function VacuumOptions({ device, disabled, send }: { device: VacuumDevice; disabled: boolean; send: Run }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const { data: areas, error } = useSWR(open && device.can.areas ? `/api/devices/${encodeURIComponent(device.id)}/vacuum-areas` : null, fetchAreas, { revalidateOnFocus: false });
  const toggle = (id: string) => setChosen(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const finish = (command: DeviceCommand) => { send(command); setOpen(false); setChosen([]); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={styles.round} disabled={disabled} aria-label={`More for ${device.name}`} title="Rooms, spot, and suction">
          <SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className={`${glassSheetClass} ${styles.sheet}`}>
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
        {device.can.spot && (
          <button type="button" className={styles.pill} onClick={() => finish({ type: "vacuum", action: "spot" })}>
            <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />Clean this spot
          </button>
        )}
        {device.fanSpeeds.length > 0 && <OptionChips label="Suction" value={device.fanSpeed} options={device.fanSpeeds} onChoose={speed => send({ type: "vacuumFanSpeed", speed })} />}
      </PopoverContent>
    </Popover>
  );
}
