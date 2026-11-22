"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { useHome } from "@/components/dashboard/use-home";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { librariesFor } from "@/lib/devices/speakers";
import type { DeviceCommand, MediaPlayerDevice } from "@/lib/devices/types";
import { useCoverTint, type Send, type View } from "./media-hooks";
import { NowPlayingBar } from "./now-playing-bar";
import { Player } from "./player";
import styles from "./media-tile.module.css";

interface MediaTileProps {
  /** The tile's own id, so two tiles of one player each morph on their own. */
  tileId: string;
  device: MediaPlayerDevice;
  /** A bar opens into the full player over the page; a player tile shows it in place. */
  layout: "bar" | "player";
  interactive: boolean;
  onCommand: (command: DeviceCommand) => Promise<void>;
}

const subscribeNothing = () => () => {};
let mounted = 0;

/** Now playing, as a bar that opens into the full player and folds back as one. */
export function MediaTile({ tileId, device, layout, interactive, onCommand }: MediaTileProps) {
  const [open, setOpen] = useState(false);
  // Each mount morphs on its own: a tile mounted again, as when switching rooms, must not glide in from where the
  // last one stood.
  const [mount] = useState(() => ++mounted);
  const [view, setView] = useState<View>("controls");
  const { home } = useHome();
  const reduce = useReducedMotion();
  const client = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const opener = useRef<HTMLButtonElement>(null);
  const tint = useCoverTint(device.artwork);
  const transition = reduce ? { duration: 0 } : motionTokens.spring.morph;
  const send: Send = command => onCommand(command).catch(() => {});
  const look = { "data-tinted": tint ? "" : undefined, "data-playing": device.state === "playing" ? "" : undefined, style: tint ? { "--tint": tint } as CSSProperties : undefined };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (view !== "controls") setView("controls");
      else close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    setOpen(false);
    setView("controls");
    requestAnimationFrame(() => opener.current?.focus());
  }

  if (layout === "player") {
    return <div className={`${glassClass("panel")} ${styles.tile}`} {...look}><Player device={device} send={send} interactive={interactive} view={view} onView={setView} /></div>;
  }

  return (
    <LayoutGroup id={`media-${tileId}-${mount}`}>
      {open ? <div className={styles.lifted} aria-hidden="true" /> : (
        <motion.div layoutId="card" className={`${glassClass("panel")} ${styles.tile}`} {...look} style={{ ...look.style, borderRadius: 26 }} transition={transition}>
          <NowPlayingBar device={device} send={send} interactive={interactive} opener={opener} onOpen={() => { setView(!device.title && librariesFor(device, home?.devices ?? [], home?.spotifyLinked).length ? "library" : "controls"); setOpen(true); }} />
        </motion.div>
      )}
      {client && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div key="scrim" className={styles.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }} onClick={close} />
          )}
          {open && (
            <div key="stage" className={styles.stage}>
              <motion.div layoutId="card" role="dialog" aria-modal="true" aria-label={`${device.name}, now playing`} className={`${glassSheetClass} ${styles.card}`} {...look} style={{ ...look.style, borderRadius: 0 }} transition={transition}>
                <Player device={device} send={send} interactive={interactive} view={view} onView={setView} autoFocus onCollapse={close} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </LayoutGroup>
  );
}
