"use client";

import { Eye, EyeOff, QrCode, Wifi } from "lucide-react";
import { useState } from "react";
import { glassClass } from "@/components/glass/glass";
import { wifiQrText } from "@/lib/widgets/schedules";
import { SetupTile } from "./choices";
import type { HouseholdTileProps } from "./types";
import { useWifiQr } from "./use-wifi-qr";
import styles from "./wifi-tile.module.css";

/**
 * Guest Wi-Fi: the network and the password behind a tap. The large template keeps a QR code on the tile; the card
 * leaves it off and opens it full screen instead.
 */
export function WifiTile({ tile, items, interactive, onManage, onShare }: HouseholdTileProps<"wifi"> & { onShare: (itemId: string) => void }) {
  const item = items.find(entry => entry.id === tile.options?.itemId);
  const [shown, setShown] = useState(false);
  const withCode = tile.size === "2x2";
  const qr = useWifiQr(item && withCode ? wifiQrText(item.data) : null, 480);

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
        {withCode && <span className={styles.hint}>Tap the code to show it bigger.</span>}
      </div>
      {withCode ? qr && (
        <button type="button" className={styles.qrButton} onClick={() => onShare(item.id)} disabled={!interactive} aria-label={`Show the QR code for ${item.data.ssid} full screen`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG data URL */}
          <img className={styles.qr} src={qr} alt="" />
        </button>
      ) : (
        <button type="button" className={`${glassClass("pill")} ${styles.share}`} onClick={() => onShare(item.id)} disabled={!interactive} aria-label={`Show the QR code for ${item.data.ssid}`} title="Show QR code">
          <QrCode size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
