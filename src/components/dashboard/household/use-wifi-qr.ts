"use client";

import { useEffect, useState } from "react";

/** The QR code a phone camera joins the network with, as a PNG: some tablet browsers draw the SVG's stroked modules as nothing. */
export function useWifiQr(text: string | null, width: number) {
  const [qr, setQr] = useState<{ text: string; url: string } | null>(null);
  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    void import("qrcode").then(({ toDataURL }) => toDataURL(text, { margin: 0, width, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }))
      .then(url => { if (!cancelled) setQr({ text, url }); });
    return () => { cancelled = true; };
  }, [text, width]);
  return qr && qr.text === text ? qr.url : null;
}
