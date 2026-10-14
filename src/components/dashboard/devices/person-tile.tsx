import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { PersonDevice } from "@/lib/devices/types";
import { PersonAvatar } from "../person-avatar";
import { relativeTime } from "../tiles/state-tile";
import styles from "./device-tiles.module.css";

/** One person: home or where they are, and since when. */
export function PersonTile({ device, config, now }: { device: PersonDevice; config: TileConfig; now: number | null }) {
  const where = device.home ? "Home" : device.place ?? "Away";
  const since = device.since && now ? relativeTime(device.since, now) : null;
  const name = config.label?.trim() || device.name;
  return (
    <section className={`${glassClass("panel")} ${styles.card} ${styles.person}`} data-size={config.size} aria-label={`${name}, ${where}`}>
      <PersonAvatar person={device} size={config.size === "1x1" ? 44 : 40} />
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{where}{since && config.size !== "1x1" ? ` · ${since}` : ""}</span>
      </span>
    </section>
  );
}
