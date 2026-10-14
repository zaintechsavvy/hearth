import { BatteryLow } from "lucide-react";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import type { Device, PersonDevice } from "@/lib/devices/types";
import { PersonAvatar } from "../person-avatar";
import { relativeTime } from "../tiles/state-tile";
import styles from "./glance.module.css";

/** Everyone in the home: who is in, who is out and where, and a phone running low. */
export function PeopleTile({ tile, devices, now }: { tile: TileConfig; devices: Device[]; now: number | null }) {
  const people = devices.filter((device): device is PersonDevice => device.kind === "person").sort((a, b) => Number(b.home) - Number(a.home) || a.name.localeCompare(b.name));
  if (people.length === 0) {
    return (
      <section className={`${glassClass("panel")} ${styles.tile} ${styles.center}`} aria-label="Who's home">
        <p className={styles.title}>No one to show yet</p>
        <p className={styles.meta}>Add people in Home Assistant, with the companion app on their phones.</p>
      </section>
    );
  }
  const home = people.filter(person => person.home).length;
  const summary = home === people.length ? "Everyone is home" : home === 0 ? "No one is home" : `${home} of ${people.length} home`;
  const where = (person: PersonDevice) => person.home ? "Home" : person.place ?? "Away";
  if (tile.size === "2x1" || tile.size === "4x1") {
    return (
      <section className={`${glassClass("panel")} ${styles.tile} ${styles.peopleRow}`} data-size={tile.size} aria-label={`Who's home: ${summary}`}>
        <span className={styles.faces}>{people.slice(0, tile.size === "4x1" ? 6 : 4).map(person => <span key={person.id} className={styles.face} title={`${person.name}, ${where(person)}`}><PersonAvatar person={person} size={34} />{tile.size === "4x1" && <span className={styles.faceName}>{person.name}</span>}</span>)}</span>
        {tile.size === "2x1" && <span className={styles.text}><span className={styles.title}>Who&apos;s home</span><span className={styles.meta}>{summary}</span></span>}
      </section>
    );
  }
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label="Who's home">
      <header className={styles.header}><span className={styles.title}>Who&apos;s home</span><span className={styles.meta}>{summary}</span></header>
      <ul className={styles.rows}>
        {people.map(person => (
          <li key={person.id} className={styles.row}>
            <PersonAvatar person={person} size={32} />
            <span className={styles.text}>
              <span className={styles.rowName}>{person.name}</span>
              <span className={styles.meta}>{where(person)}{person.since && now ? ` · ${relativeTime(person.since, now)}` : ""}</span>
            </span>
            {person.battery !== null && person.battery < 20 && <span className={styles.warn} title={`Phone at ${person.battery}%`}><BatteryLow size={16} strokeWidth={1.75} aria-label={`Phone at ${person.battery}%`} /></span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
