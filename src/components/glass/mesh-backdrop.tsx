"use client";

import { MeshGradient } from "@paper-design/shaders-react";
import styles from "./wallpaper.module.css";

/** Drawn at a fraction of screen resolution: the gradient has no edges to sharpen, and the GPU stays cool. */
const MAX_PIXELS = 1280 * 800;

interface MeshBackdropProps {
  colors: string[];
  still: boolean;
  /** 0 to 1. */
  motion?: number;
  swirl?: number;
  distortion?: number;
  grain?: boolean;
  className?: string;
}

export default function MeshBackdrop({ colors, still, motion = 0.3, swirl = 0.35, distortion = 0.85, grain = false, className }: MeshBackdropProps) {
  return (
    <MeshGradient
      className={className ?? styles.mesh}
      colors={colors}
      distortion={distortion}
      swirl={swirl}
      grainMixer={grain ? 0.35 : 0}
      grainOverlay={grain ? 0.25 : 0}
      speed={still ? 0 : motion * 0.6}
      frame={still ? 42_000 : undefined}
      minPixelRatio={1}
      maxPixelCount={MAX_PIXELS}
    />
  );
}
