"use client";

import type { RefObject } from "react";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import { CoverArt } from "./cover-art";
import { usePosition, type Send } from "./media-hooks";
import { ProgressRail } from "./progress-rail";
import { TrackText } from "./track-text";
import { Transport } from "./transport";
import styles from "./media-tile.module.css";

/** The compact tile: cover, title and artist, play and next, and the rail along the bottom. A tap anywhere else opens the player. */
export function NowPlayingBar({ device, send, interactive, opener, onOpen }: { device: MediaPlayerDevice; send: Send; interactive: boolean; opener: RefObject<HTMLButtonElement | null>; onOpen: () => void }) {
  const position = usePosition(device);
  return (
    <div className={styles.bar}>
      <button ref={opener} type="button" className={styles.tap} aria-label={`Open ${device.name}`} aria-expanded={false} disabled={!interactive} onClick={onOpen} />
      <CoverArt device={device} />
      <TrackText device={device} />
      <Transport device={device} send={send} disabled={!interactive} size="bar" morph />
      <ProgressRail position={position} duration={device.duration} />
    </div>
  );
}
