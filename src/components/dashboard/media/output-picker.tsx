"use client";

import { Check, ChevronRight, Info } from "lucide-react";
import { useState } from "react";
import { useHome } from "@/components/dashboard/use-home";
import { speakersFor, type Speaker } from "@/lib/devices/speakers";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import type { Send } from "./media-hooks";
import { OutputIcon } from "./output-icon";
import { ViewHead } from "./view-head";
import styles from "./media-tile.module.css";

/**
 * Every speaker in the home: the player's own outputs, such as Spotify Connect devices, speakers it groups with, and
 * the rest, which take the music over. A speaker it cannot reach stays listed and says why. A speaker's Spotify input
 * opens Spotify's library, since switching the speaker to it plays nothing.
 */
export function OutputPicker({ device, send, disabled, onDone, onLibrary }: { device: MediaPlayerDevice; send: Send; disabled: boolean; onDone?: () => void; onLibrary?: () => void }) {
  const { home, send: sendTo } = useHome();
  const [why, setWhy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const devices = home?.devices ?? [];
  const speakers = speakersFor(device, devices, Boolean(onLibrary));
  const run = (work: Promise<unknown>) => { setError(null); work.catch((failure: Error) => setError(failure.message || "That speaker did not answer.")); };

  const pick = (speaker: Speaker) => {
    if (speaker.via === "unreachable") return setWhy(why === speaker.key ? null : speaker.key);
    if (speaker.via === "library") return onLibrary?.();
    setWhy(null);
    if (speaker.via === "output" && speaker.output && !speaker.current) run(send({ type: "output", output: speaker.output }));
    if (speaker.via === "group" && speaker.device) run(speaker.grouped ? sendTo(speaker.device, { type: "unjoin" }) : send({ type: "join", members: [speaker.device.id] }));
    if (speaker.via === "move" && speaker.device && device.media) {
      const { id, type } = device.media;
      run(sendTo(speaker.device, { type: "playMedia", id, mediaType: type }).then(() => device.state === "playing" ? send({ type: "media", action: "pause" }) : undefined));
    }
  };

  const grouped = device.group.length > 1;
  return (
    <div className={styles.list}>
      <ViewHead title={grouped ? `Playing on ${device.group.length} speakers` : "Play on"} onBack={onDone} />
      {speakers.length === 0 && <p className={styles.note}>No other speakers in this home yet.</p>}
      <div className={styles.rows} role="list">
        {speakers.map(speaker => {
          const checked = speaker.current || Boolean(speaker.grouped);
          const detail = speaker.via === "group" ? (speaker.grouped ? "Playing together" : "Add to the group")
            : speaker.via === "move" ? (speaker.device?.state === "playing" && speaker.device.title ? `Playing ${speaker.device.title}` : "Move the music here")
            : speaker.via === "unreachable" ? "Not reachable from here"
            : speaker.via === "library" ? "Open Spotify's playlists"
            : speaker.current ? "Playing here" : null;
          return (
            <div key={speaker.key} role="listitem" className={styles.speaker}>
              <button type="button" className={styles.row} data-current={checked || undefined} data-dim={speaker.via === "unreachable" || undefined}
                aria-pressed={speaker.via === "unreachable" || speaker.via === "library" ? undefined : checked} aria-expanded={speaker.via === "unreachable" ? why === speaker.key : undefined}
                disabled={disabled || (speaker.via === "move" && !device.media)} onClick={() => pick(speaker)}>
                <span className={styles.rowIcon} data-on={checked || undefined}><OutputIcon name={speaker.name} size={18} /></span>
                <span className={styles.rowText}>
                  <span className={styles.rowName}>{speaker.name}</span>
                  {(speaker.room || detail) && <span className={styles.rowMeta}>{[speaker.room !== speaker.name ? speaker.room : null, detail].filter(Boolean).join(" · ")}</span>}
                </span>
                {speaker.via === "unreachable" ? <Info size={16} strokeWidth={1.75} className={styles.rowChevron} aria-hidden="true" />
                  : speaker.via === "group" ? <span className={styles.tick} data-on={speaker.grouped || undefined} aria-hidden="true">{speaker.grouped && <Check size={14} strokeWidth={2} />}</span>
                  : speaker.via === "library" ? <ChevronRight size={18} strokeWidth={1.75} className={styles.rowChevron} aria-hidden="true" />
                  : speaker.current ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : null}
              </button>
              {why === speaker.key && <p className={styles.callout}>{speaker.reason}</p>}
            </div>
          );
        })}
      </div>
      {error && <p className={styles.callout} role="alert">{error}</p>}
    </div>
  );
}
