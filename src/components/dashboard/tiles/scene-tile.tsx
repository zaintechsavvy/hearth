"use client";

import { useEffect, useState } from "react";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig, TileIcon } from "@/lib/dashboard/layout";
import type { SceneRun } from "@/lib/home";
import type { HearthScene } from "@/lib/scenes/types";
import { TILE_ICON_COMPONENTS } from "./tile-icons";
import styles from "./tile.module.css";

interface SceneTileProps {
  scene: HearthScene;
  config: TileConfig;
  onRun: () => Promise<SceneRun>;
  interactive?: boolean;
}

/** A Hearth scene: one tap sets every device in it, and the tile says how that went. */
export function SceneTile({ scene, config, onRun, interactive = true }: SceneTileProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const Icon = TILE_ICON_COMPONENTS[config.icon ?? (scene.icon as TileIcon | null) ?? "clapperboard"];
  const color = config.color ?? "violet";

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  async function run() {
    setRunning(true);
    try {
      const result = await onRun();
      setStatus(result.failed.length ? `${result.failed.map(item => item.name).join(", ")} did not respond` : "Done");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : "The scene did not run.");
    } finally {
      setRunning(false);
    }
  }

  const meta = running ? "Running" : status ?? `${scene.actions.length} ${scene.actions.length === 1 ? "device" : "devices"}`;
  return (
    <button
      type="button"
      className={`${glassClass("panel")} ${styles.tile} ${styles.press}`}
      data-color={color}
      data-size={config.size}
      data-template="toggle"
      data-on={running || status === "Done" || undefined}
      onClick={run}
      disabled={!interactive || running}
      aria-label={`Run ${scene.name}`}
    >
      {config.size === "1x1" ? (
        <>
          <span className={styles.icon} aria-hidden="true"><Icon size={28} strokeWidth={1.75} /></span>
          <span className={styles.name}>{scene.name}</span>
        </>
      ) : (
        <>
          <span className={styles.badge}><span className={styles.icon} aria-hidden="true"><Icon size={22} strokeWidth={1.75} /></span></span>
          <span className={styles.text}>
            <span className={styles.name}>{scene.name}</span>
            <span className={styles.meta} aria-live="polite">{meta}</span>
          </span>
        </>
      )}
    </button>
  );
}
