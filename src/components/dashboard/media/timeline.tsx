"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clamp, type MediaPlayerDevice } from "@/lib/devices/types";
import { clock, usePosition, type Send } from "./media-hooks";
import { ProgressRail } from "./progress-rail";
import styles from "./media-tile.module.css";

/** The rail with elapsed and remaining time. Where the player allows it, a press or a drag on the rail moves through the track. */
export function Timeline({ device, send, disabled }: { device: MediaPlayerDevice; send: Send; disabled: boolean }) {
  const live = usePosition(device);
  const [scrub, setScrub] = useState<number | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const { duration } = device;
  if (live === null || !duration) return <div className={styles.timeline} data-empty aria-hidden="true"><span className={styles.rail} /></div>;
  const shown = scrub ?? live;
  const seekable = device.can.seek && !disabled;
  const at = (event: PointerEvent) => {
    const box = rail.current?.getBoundingClientRect();
    return box ? clamp((event.clientX - box.left) / box.width, 0, 1) * duration : shown;
  };
  const commit = (seconds: number) => { setScrub(seconds); void send({ type: "seek", position: Math.round(seconds) }).finally(() => setScrub(null)); };
  const key = (event: KeyboardEvent) => {
    const step = event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : null;
    if (step === null) return;
    event.preventDefault();
    commit(clamp(shown + step, 0, duration));
  };
  return (
    <div className={styles.timeline}>
      <div ref={rail} className={styles.scrubber} data-seekable={seekable || undefined} data-scrubbing={scrub !== null || undefined}
        role={seekable ? "slider" : undefined} tabIndex={seekable ? 0 : undefined} aria-label={seekable ? "Position in track" : undefined}
        aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(shown)} aria-valuetext={`${clock(shown)} of ${clock(duration)}`}
        onPointerDown={seekable ? event => { event.currentTarget.setPointerCapture(event.pointerId); setScrub(at(event)); } : undefined}
        onPointerMove={seekable ? event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setScrub(at(event)); } : undefined}
        onPointerUp={seekable ? event => commit(at(event)) : undefined}
        onKeyDown={seekable ? key : undefined}>
        <ProgressRail position={shown} duration={duration} />
        {seekable && <span className={styles.knob} style={{ left: `${clamp(shown / duration, 0, 1) * 100}%` }} aria-hidden="true" />}
      </div>
      <span className={styles.clock} aria-hidden="true"><span>{clock(shown)}</span><span>−{clock(duration - shown)}</span></span>
    </div>
  );
}
