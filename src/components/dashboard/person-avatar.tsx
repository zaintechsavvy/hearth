import type { PersonDevice } from "@/lib/devices/types";
import styles from "./person-avatar.module.css";

const HUES = [252, 148, 12, 295, 52, 192];

/** A person's picture, or their initial on a colour of their own, ringed green while they are home. */
export function PersonAvatar({ person, size = 40 }: { person: PersonDevice; size?: number }) {
  const hue = HUES[[...person.name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % HUES.length];
  return (
    <span className={styles.avatar} data-home={person.home || undefined} style={{ width: size, height: size, "--hue": hue } as React.CSSProperties} aria-hidden="true">
      {person.picture ? <span className={styles.picture} style={{ backgroundImage: `url("${person.picture}")` }} /> : <span className={styles.initial} style={{ fontSize: size * 0.42 }}>{person.name.slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}
