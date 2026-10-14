"use client";

import { Check, ExternalLink, PackageCheck, RotateCcw, Settings2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { glassClass } from "@/components/glass/glass";
import { syncPackages } from "@/lib/package-actions";
import { setPackageStatus } from "@/lib/widget-actions";
import type { ItemData } from "@/lib/widgets/items";
import { followable, packageSource, shownPackages, trackingUrl } from "@/lib/widgets/packages";

/** How often an open dashboard asks the tracker for new scans. */
const SYNC_MS = 15 * 60_000;
import { useMinute } from "../widgets/use-minute";
import { SetupTile } from "./choices";
import type { HouseholdTileProps } from "./types";
import styles from "./household.module.css";
import own from "./packages-tile.module.css";

type Status = ItemData<"package">["status"];

/** Deliveries: what is coming and when, and, once one arrives, a nudge to collect it with a tap to say it is in. */
export function PackagesTile({ items, interactive, onManage }: HouseholdTileProps<"package">) {
  const now = useMinute();
  const [moved, setMoved] = useState<Record<string, Status>>({});
  const followed = items.filter(item => followable(item.data)).map(item => item.id).join();
  useEffect(() => {
    if (!interactive || !followed) return;
    void syncPackages();
    const timer = setInterval(() => void syncPackages(), SYNC_MS);
    return () => clearInterval(timer);
  }, [interactive, followed]);
  if (items.length === 0) return <SetupTile icon="package" title="Track a package" hint="When it arrives, and a nudge to collect it" tone="#f59e0b" onClick={() => onManage()} interactive={interactive} />;
  const date = new Date(now ?? 0);
  const stamp = new Date().toISOString();
  const shown = shownPackages(items.map(item => {
    const status = moved[item.id];
    if (!status) return item;
    return { ...item, data: { ...item.data, status, deliveredAt: status === "coming" ? null : item.data.deliveredAt ?? stamp, collectedAt: status === "collected" ? item.data.collectedAt ?? stamp : null } };
  }), date);
  const toCollect = shown.filter(entry => entry.status.mood === "collect").length;
  const coming = shown.filter(entry => entry.item.data.status === "coming").length;
  const move = (id: string, status: Status) => { setMoved(current => ({ ...current, [id]: status })); void setPackageStatus(id, status); };

  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} aria-label="Packages">
      <header className={styles.header}>
        <div>
          <h3 className={styles.title}>Packages</h3>
          <p className={styles.meta}>{[toCollect ? `${toCollect} to collect` : null, coming ? `${coming} on the way` : null].filter(Boolean).join(" · ") || "All collected"}</p>
        </div>
        {interactive && <button type="button" className={styles.manage} onClick={() => onManage()} aria-label="Edit packages"><Settings2 size={15} strokeWidth={1.75} aria-hidden="true" /></button>}
      </header>
      <ul className={styles.list}>
        {shown.map(({ item, status }) => {
          const link = item.data.tracking ? trackingUrl(item.data.carrier, item.data.tracking) : null;
          const by = packageSource(item.data);
          return (
            <li key={item.id} className={own.package} data-mood={status.mood}>
              <span className={own.icon} aria-hidden="true"><PackageCheck size={18} strokeWidth={1.75} /></span>
              <span className={own.text}>
                <span className={own.name}>{item.data.name}{by && <span className={own.by}> · {by}</span>}</span>
                <span className={own.words}>{now === null ? "" : [status.words, item.data.status === "coming" ? item.data.track?.info || item.data.track?.location : null].filter(Boolean).join(" · ")}</span>
              </span>
              <span className={own.actions}>
                {link && status.mood !== "collect" && status.mood !== "collected" && (
                  <a className={own.track} href={link} target="_blank" rel="noreferrer" aria-label={`Track ${item.data.name}`} title="Track"><ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" /></a>
                )}
                {item.data.status === "coming" && (
                  <button type="button" className={own.step} disabled={!interactive} aria-label={`${item.data.name} arrived`} onClick={() => move(item.id, "delivered")}><Truck size={16} strokeWidth={1.75} aria-hidden="true" /><span className={own.label}>Arrived</span></button>
                )}
                {item.data.status === "delivered" && (
                  <button type="button" className={own.collect} disabled={!interactive} aria-label={`Collected ${item.data.name}`} onClick={() => move(item.id, "collected")}>
                    <Check size={16} strokeWidth={1.75} aria-hidden="true" /><span className={own.label}>Collected</span>
                  </button>
                )}
                {item.data.status === "collected" && (
                  <button type="button" className={own.step} disabled={!interactive} onClick={() => move(item.id, "delivered")} aria-label={`${item.data.name} is not collected yet`}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /><span className={own.label}>Undo</span></button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
