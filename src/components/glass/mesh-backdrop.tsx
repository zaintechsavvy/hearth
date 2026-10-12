"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import styles from "./wallpaper.module.css";

/** Drawn at a fraction of screen resolution: the gradient has no edges to sharpen, and the GPU stays cool. */
const MAX_PIXELS = 1280 * 800;

export default function MeshBackdrop({ colors, still }: { colors: string[]; still: boolean }) {
  return (
    <MeshGradient
      className={styles.mesh}
      colors={colors}
      distortion={0.85}
      swirl={0.35}
      grainMixer={0}
      grainOverlay={0}
      speed={still ? 0 : 0.18}
      frame={still ? 42_000 : undefined}
      minPixelRatio={1}
      maxPixelCount={MAX_PIXELS}
    />
  );
}
