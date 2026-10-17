"use client";

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import type { WidgetItem } from "@/lib/widgets/items";
import { wifiQrText } from "@/lib/widgets/schedules";
import { useWifiQr } from "./use-wifi-qr";
import styles from "./wifi-share.module.css";

/** The guest Wi-Fi code filling the screen, big enough to scan from across a room, with the password written under it. */
export function WifiShare({ items, itemId, onOpenChange }: { items: WidgetItem<"wifi">[]; itemId: string | null | undefined; onOpenChange: (open: boolean) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const open = itemId !== undefined && items.length > 0;
  const item = items.find(entry => entry.id === (picked ?? itemId)) ?? items[0];
  const qr = useWifiQr(item ? wifiQrText(item.data) : null, 960);
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) setPicked(null); onOpenChange(next); }}>
      {item && (
        <DialogContent className={styles.sheet} title={`Join ${item.data.ssid}`} description="Point a phone camera at the code, then tap the link that appears.">
          <div className={styles.body}>
            {items.length > 1 && (
              <SegmentedControl label="Network" value={item.id} onValueChange={setPicked} options={items.map(entry => ({ value: entry.id, label: entry.data.ssid }))} />
            )}
            <div className={styles.code}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG data URL */}
              {qr ? <img src={qr} alt={`QR code to join ${item.data.ssid}`} /> : <span className={styles.wait} aria-hidden="true" />}
            </div>
            <dl className={styles.facts}>
              <div><dt>Network</dt><dd>{item.data.ssid}</dd></div>
              <div><dt>Password</dt><dd className={styles.password}>{item.data.security === "nopass" ? "None" : item.data.password}</dd></div>
            </dl>
            <DialogClose asChild><Button size="lg" className={styles.done}>Done</Button></DialogClose>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
