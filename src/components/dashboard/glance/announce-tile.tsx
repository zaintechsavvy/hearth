"use client";

import { Megaphone, Speaker } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig, TileOptions } from "@/lib/dashboard/layout";
import type { Device, DeviceCommand, MediaPlayerDevice } from "@/lib/devices/types";
import styles from "./glance.module.css";

const QUICK = ["Dinner is ready", "Time to go", "Five minutes", "Lights out soon"];

/** Type a message and the chosen speakers say it out loud, through Home Assistant's text to speech. */
export function AnnounceTile({ tile, devices, interactive, onOptions, onCommand }: { tile: TileConfig; devices: Device[]; interactive: boolean; onOptions: (patch: Partial<TileOptions>) => void; onCommand: (device: Device, command: DeviceCommand) => Promise<void> }) {
  const speakers = devices.filter((device): device is MediaPlayerDevice => device.kind === "media_player" && device.available);
  const chosen = (tile.options?.speakers ?? []).filter(id => speakers.some(speaker => speaker.id === id));
  const targets = chosen.length ? chosen : speakers.slice(0, 1).map(speaker => speaker.id);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const say = async (text: string) => {
    if (!text.trim() || !targets.length) return;
    setPending(true);
    const results = await Promise.allSettled(targets.map(id => onCommand(speakers.find(speaker => speaker.id === id)!, { type: "announce", message: text.trim() })));
    setPending(false);
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    setStatus(failed ? (failed.reason instanceof Error ? failed.reason.message : "It could not be announced.") : `Said on ${targets.length} ${targets.length === 1 ? "speaker" : "speakers"}`);
    if (!failed) setMessage("");
  };
  const toggle = (id: string) => onOptions({ speakers: targets.includes(id) ? targets.filter(item => item !== id) : [...targets, id] });
  if (speakers.length === 0) {
    return (
      <section className={`${glassClass("panel")} ${styles.tile} ${styles.center}`} aria-label="Announce">
        <Megaphone size={24} strokeWidth={1.75} aria-hidden="true" />
        <p className={styles.title}>No speakers yet</p>
        <p className={styles.meta}>Speakers from Home Assistant show up here.</p>
      </section>
    );
  }
  return (
    <section className={`${glassClass("panel")} ${styles.tile} ${styles.announce}`} data-size={tile.size} aria-label="Announce">
      <form className={styles.say} onSubmit={event => { event.preventDefault(); void say(message); }}>
        <input className={styles.input} value={message} onChange={event => { setMessage(event.target.value); setStatus(null); }} placeholder="Say something to the house" aria-label="Message" maxLength={300} disabled={!interactive} />
        <Button type="submit" size="sm" loading={pending} disabled={!interactive || !message.trim()}>Say it</Button>
      </form>
      <div className={styles.chips}>{QUICK.map(text => <button key={text} type="button" className={styles.chip} disabled={!interactive || pending} onClick={() => void say(text)}>{text}</button>)}</div>
      <div className={styles.chips} role="group" aria-label="Speakers">
        {speakers.map(speaker => (
          <button key={speaker.id} type="button" className={styles.chip} data-on={targets.includes(speaker.id) || undefined} aria-pressed={targets.includes(speaker.id)} disabled={!interactive} onClick={() => toggle(speaker.id)}>
            <Speaker size={14} strokeWidth={1.75} aria-hidden="true" />{speaker.name}
          </button>
        ))}
      </div>
      {status && <p className={styles.meta} role="status">{status}</p>}
    </section>
  );
}
