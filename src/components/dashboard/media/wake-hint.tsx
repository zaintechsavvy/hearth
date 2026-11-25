import Link from "next/link";
import type { SpotifyWakeMethod } from "@/lib/integrations/types";
import styles from "./media-tile.module.css";

export const WAKE_HELP = "/settings#spotify";

export const WAKE_LABELS: Record<SpotifyWakeMethod | "voice", string> = { spotcast: "Spotcast", assistant: "Google Assistant", voice: "your voice" };

/** How Hearth starts Spotify on idle Google speakers, with the way to one-tap starts when it asks by voice. */
export function WakeHint({ method }: { method: SpotifyWakeMethod | null }) {
  return (
    <p className={styles.wakeHint}>
      Waking Google speakers with {WAKE_LABELS[method ?? "voice"]}.{" "}
      {!method && <Link href={WAKE_HELP} className={styles.wakeLink}>Set up one-tap start</Link>}
    </p>
  );
}
