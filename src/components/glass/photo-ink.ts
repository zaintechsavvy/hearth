"use client";

import { useEffect } from "react";
import type { PhotoBackground } from "@/lib/theme";

const COLS = 32;

const linear = (value: number) => {
  const v = value / 255;
  return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
};

/** Whichever of near white or near black text reads better on a luminance, by contrast ratio. */
const inkFor = (luminance: number) => (1.05 / (luminance + .05) >= (luminance + .05) / .05 ? "light" : "dark");

/**
 * Over a photo of your own, text sitting on the wallpaper turns light or dark by what is behind it there: the photo
 * is sampled as it is laid out on screen, dimming veil included, and each `[data-on-wall]` block reads the patch
 * under it. A photo dark at the top and bright in the middle gets white headings above and dark ones below.
 */
export function usePhotoInk(photo: PhotoBackground | null, theme: "light" | "dark") {
  useEffect(() => {
    if (!photo) return;
    let grid: Float32Array | null = null;
    let rows = 0;
    let frame = 0;
    const image = new Image();
    image.src = `/api/backgrounds/${photo.id}`;

    const sample = () => {
      if (!image.naturalWidth) return;
      rows = Math.max(1, Math.round(COLS * innerHeight / innerWidth));
      const canvas = document.createElement("canvas");
      canvas.width = COLS;
      canvas.height = rows;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      const scale = Math.max(COLS / image.naturalWidth, rows / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      context.drawImage(image, (COLS - width) / 2, (rows - height) / 2, width, height);
      const pixels = context.getImageData(0, 0, COLS, rows).data;
      const veil = theme === "light" ? 1 : 0;
      grid = new Float32Array(COLS * rows);
      for (let cell = 0; cell < grid.length; cell++) {
        const at = cell * 4;
        const luminance = .2126 * linear(pixels[at]) + .7152 * linear(pixels[at + 1]) + .0722 * linear(pixels[at + 2]);
        grid[cell] = luminance * (1 - photo.dim) + veil * photo.dim;
      }
    };

    const paint = () => {
      frame = 0;
      if (!grid) return;
      for (const element of document.querySelectorAll<HTMLElement>("[data-on-wall]")) {
        const box = element.getBoundingClientRect();
        if (box.bottom < 0 || box.top > innerHeight || !box.width) continue;
        const left = Math.max(0, Math.floor(box.left / innerWidth * COLS)), right = Math.min(COLS - 1, Math.floor(box.right / innerWidth * COLS));
        const top = Math.max(0, Math.floor(box.top / innerHeight * rows)), bottom = Math.min(rows - 1, Math.floor(box.bottom / innerHeight * rows));
        let total = 0, count = 0;
        for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) { total += grid[row * COLS + col]; count++; }
        if (count) element.dataset.ink = inkFor(total / count);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const resize = () => { sample(); schedule(); };

    image.onload = resize;
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", resize);
    // Text moves without a scroll too: a section opens, a list loads, a panel folds away.
    const changes = new MutationObserver(schedule);
    changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "data-open", "aria-expanded"] });
    const layout = new ResizeObserver(schedule);
    layout.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", schedule);
      removeEventListener("resize", resize);
      changes.disconnect();
      layout.disconnect();
      for (const element of document.querySelectorAll<HTMLElement>("[data-ink]")) delete element.dataset.ink;
    };
  }, [photo, theme]);
}
