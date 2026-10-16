"use client";

import { Eye, EyeOff, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { glassClass } from "@/components/glass/glass";
import { wifiQrText } from "@/lib/widgets/schedules";
import { SetupTile } from "./choices";
import type { HouseholdTileProps } from "./types";
import styles from "./wifi-tile.module.css";

/** Guest Wi-Fi: the network, the password behind a tap, and a QR code phones join with from the camera. */
export function WifiTile({ tile, items, interactive, onManage }: HouseholdTileProps<"wifi">) {
  const item = items.find(entry => entry.id === tile.options?.itemId);
  const [shown, setShown] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const text = item ? wifiQrText(item.data) : null;

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    // A PNG rather than an SVG: some tablet browsers draw the SVG's stroked modules as nothing, leaving a white square.
    void import("qrcode").then(({ toDataURL }) => toDataURL(text, { margin: 0, width: 480, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }))
      .then(url => { if (!cancelled) setQr(url); });
    return () => { cancelled = true; };
  }, [text]);

  if (!item) return <SetupTile icon="wifi" title="Share your guest Wi-Fi" hint="Network, password, QR code" tone="#3b82f6" onClick={() => onManage()} interactive={interactive} wide={tile.size === "2x1"} />;
  const open = item.data.security === "nopass";
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} aria-label={`Guest Wi-Fi ${item.data.ssid}`}>
      <div className={styles.text}>
        <span className={styles.label}><Wifi size={14} strokeWidth={2} aria-hidden="true" /> Guest Wi-Fi</span>
        <button type="button" className={styles.ssid} onClick={() => onManage(item.id)} disabled={!interactive}>{item.data.ssid}</button>
        {open ? <span className={styles.password}>No password</span> : (
          <button type="button" className={styles.reveal} onClick={() => setShown(value => !value)} aria-label={shown ? "Hide password" : "Show password"}>
            <span className={styles.password} data-hidden={!shown || undefined}>{shown ? item.data.password : "••••••••"}</span>
            {shown ? <EyeOff size={14} strokeWidth={1.75} aria-hidden="true" /> : <Eye size={14} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        )}
        {tile.size === "2x2" && <span className={styles.hint}>Point a phone camera at the code to join.</span>}
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element -- a generated inline SVG data URL
        <img className={styles.qr} src={qr} alt={`QR code to join ${item.data.ssid}`} />
      )}
    </section>
  );
}
