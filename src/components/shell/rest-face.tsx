"use client";

import type { CSSProperties } from "react";
import { useTick } from "@/components/dashboard/household/use-tick";
import { clockColorOf, restBrightness, type WallSettings } from "@/lib/wall";
import { AnalogFace } from "./analog-face";
import { DaylightFace } from "./daylight-face";
import { DigitalGlance } from "./digital-glance";
import { LuxuryFace } from "./luxury-face";
import { WordFace } from "./word-face";
import styles from "./wall-mode.module.css";

/** The chosen clock face of the resting screen, in its colour and at its brightness for the time of night. */
export function RestFace({ settings, night, note = null, sun = null }: {
  settings: WallSettings; night: boolean; note?: string | null; sun?: { sunrise: string; sunset: string } | null;
}) {
  const now = useTick(1000) ?? 0;
  const style = { "--saver-dim": restBrightness(settings, night), color: night && settings.nightRed ? undefined : clockColorOf(settings) } as CSSProperties;
  const face = {
    digital: <DigitalGlance now={now} settings={settings} />,
    analog: <AnalogFace night={night} settings={settings} note={note} />,
    luxury: <LuxuryFace night={night} settings={settings} />,
    words: <WordFace night={night} settings={settings} />,
    daylight: <DaylightFace night={night} settings={settings} sun={sun} />,
  }[settings.clockFace];
  return <span style={style} className={styles.restFace}>{face}</span>;
}
