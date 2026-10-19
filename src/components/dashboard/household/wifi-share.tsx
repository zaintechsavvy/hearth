"use client";

import { Eye, EyeOff } from "lucide-react";
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
  const [shown, setShown] = useState(false);
  const open = itemId !== undefined && items.length > 0;
  const item = items.find(entry => entry.id === (picked ?? itemId)) ?? items[0];
  const qr = useWifiQr(item ? wifiQrText(item.data) : null, 960);
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) { setPicked(null); setShown(false); } onOpenChange(next); }}>
      {item && (
        <DialogContent className={styles.sheet} title={`Join ${item.data.ssid}`} description="Point a phone camera at the code, then tap the link that appears.">
          <div className={styles.body}>
            <div className={styles.code}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG data URL */}
              {qr ? <img src={qr} alt={`QR code to join ${item.data.ssid}`} /> : <span className={styles.wait} aria-hidden="true" />}
            </div>
            <div className={styles.side}>
              {items.length > 1 && (
                <SegmentedControl label="Network" value={item.id} onValueChange={id => { setPicked(id); setShown(false); }} options={items.map(entry => ({ value: entry.id, label: entry.data.ssid }))} />
              )}
              <dl className={styles.facts}>
                <div><dt>Network</dt><dd className={styles.ssid}>{item.data.ssid}</dd></div>
                <div>
                  <dt>Password</dt>
                  {item.data.security === "nopass" ? <dd>None needed</dd> : (
                    <dd className={styles.secret}>
                      <span className={styles.password} data-hidden={!shown || undefined}>{shown ? item.data.password : "•".repeat(Math.min(12, Math.max(8, item.data.password.length)))}</span>
                      <button type="button" className={styles.reveal} onClick={() => setShown(value => !value)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}>
                        {shown ? <EyeOff size={18} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.75} aria-hidden="true" />}
                      </button>
                    </dd>
                  )}
                </div>
              </dl>
              <DialogClose asChild><Button size="lg" className={styles.done}>Done</Button></DialogClose>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
