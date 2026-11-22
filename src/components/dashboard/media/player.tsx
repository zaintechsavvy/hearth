"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, Library, ListMusic } from "lucide-react";
import { useId } from "react";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import { CoverArt } from "./cover-art";
import { FavouriteButton } from "./favourite-button";
import { LibraryPanel } from "./library-panel";
import type { Send, View } from "./media-hooks";
import { OutputIcon } from "./output-icon";
import { OutputPicker } from "./output-picker";
import { QueuePanel } from "./queue-panel";
import { Timeline } from "./timeline";
import { TrackText } from "./track-text";
import { Transport } from "./transport";
import { VolumeControl } from "./volume-control";
import styles from "./media-tile.module.css";

interface PlayerProps {
  device: MediaPlayerDevice;
  send: Send;
  interactive: boolean;
  view: View;
  onView: (view: View) => void;
  autoFocus?: boolean;
  /** Set when the player is open over the page, which it folds back into the bar. */
  onCollapse?: () => void;
}

/**
 * The full player. The library, up next, and speakers open beside the controls on a wide screen and in their place
 * on a narrow one, where a small set of controls stays in the header.
 */
export function Player({ device, send, interactive, view, onView, autoFocus, onCollapse }: PlayerProps) {
  const titleId = useId();
  const reduce = useReducedMotion();
  const disabled = !interactive;
  const fade = { initial: { opacity: 0, y: reduce ? 0 : 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: reduce ? 0 : 0.18 } };
  const toggle = (next: View) => onView(view === next ? "controls" : next);
  const back = () => onView("controls");
  const where = device.group.length > 1 ? `${device.group.length} speakers` : device.output ?? device.name;
  return (
    <div className={styles.player} data-panel={view !== "controls" || undefined}>
      {onCollapse && device.artwork && <span className={styles.ambient} style={{ backgroundImage: `url("${device.artwork}")` }} aria-hidden="true" />}
      <div className={styles.head}>
        {onCollapse ? (
          <button type="button" className={styles.headTap} aria-label="Fold the player back" onClick={onCollapse}>
            <CoverArt device={device} />
            <TrackText device={device} id={titleId} album />
          </button>
        ) : (
          <>
            <CoverArt device={device} />
            <TrackText device={device} id={titleId} album />
          </>
        )}
        <span className={styles.headOps}><Transport device={device} send={send} disabled={disabled} size="mini" /></span>
        <FavouriteButton device={device} disabled={disabled} />
        {onCollapse && <button type="button" className={styles.collapse} aria-label="Close the player" onClick={onCollapse}><ChevronDown size={22} strokeWidth={1.75} aria-hidden="true" /></button>}
      </div>
      <div className={styles.body}>
        <Timeline device={device} send={send} disabled={disabled} />
        <Transport device={device} send={send} disabled={disabled} size="large" morph autoFocus={autoFocus} />
        {device.can.volume && <VolumeControl device={device} send={send} disabled={disabled} />}
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {view !== "controls" && (
          <motion.section key={view} className={styles.panel} {...fade}>
            {view === "library" && <LibraryPanel device={device} disabled={disabled} onBack={back} onOutputs={() => onView("outputs")} />}
            {view === "outputs" && <OutputPicker device={device} send={send} disabled={disabled} onDone={back} />}
            {view === "queue" && <QueuePanel device={device} send={send} disabled={disabled} onBack={back} />}
          </motion.section>
        )}
      </AnimatePresence>
      <nav className={styles.foot} aria-label="Player">
        <button type="button" className={styles.footButton} aria-pressed={view === "library"} disabled={disabled} onClick={() => toggle("library")}>
          <Library size={18} strokeWidth={1.75} aria-hidden="true" /><span>Library</span>
        </button>
        <button type="button" className={styles.footButton} aria-pressed={view === "queue"} disabled={disabled} onClick={() => toggle("queue")}>
          <ListMusic size={18} strokeWidth={1.75} aria-hidden="true" /><span>Up next</span>
        </button>
        <button type="button" className={styles.footButton} data-where aria-pressed={view === "outputs"} aria-label={`Playing on ${where}. Choose where it plays`} disabled={disabled} onClick={() => toggle("outputs")}>
          <OutputIcon name={device.output ?? device.name} size={18} /><span>{where}</span>
        </button>
      </nav>
    </div>
  );
}
