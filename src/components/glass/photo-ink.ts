"use client";

import { useEffect } from "react";
import { PHOTO_EDGES_KEY, type PhotoBackground } from "@/lib/theme";

const COLS = 32;
/** How much of the top and bottom of the photo stands for the colour Safari paints behind its bars. */
const EDGE_SHARE = .08;
const EDGE_VARS = ["--edge-top", "--edge-bottom", "--page-floor"];

const linear = (value: number) => {
  const v = value / 255;
  return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
};

/** Whichever of near white or near black text reads better on a luminance, by contrast ratio. */
const inkFor = (luminance: number) => (1.05 / (luminance + .05) >= (luminance + .05) / .05 ? "light" : "dark");

/**
 * Over a photo of your own, a title sitting on the wallpaper is light or dark by what is behind it: the photo is
 * sampled as it is laid out on screen, dimming veil included, and each `[data-on-wall]` block reads the patch under
 * where it sits on the page. It is decided by the page, not the scroll, so text never changes as it moves; text that
 * scrolls over the photo sits on its own backing instead (`[data-backed]`, `[data-wall-chip]`) and keeps its colours.
 */
/** The backdrop's height, the largest viewport, as the wallpaper lays the photo out at `100lvh`. */
const screenHeight = () => Math.max(innerHeight, document.documentElement.clientHeight, CSS.supports("height", "1lvh") ? lvh() : 0);
function lvh() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;height:100lvh;visibility:hidden;pointer-events:none";
  document.body.append(probe);
  const value = probe.getBoundingClientRect().height;
  probe.remove();
  return value;
}

export function usePhotoInk(photo: PhotoBackground | null, theme: "light" | "dark") {
  useEffect(() => {
    if (!photo) return;
    let grid: Float32Array | null = null;
    let rows = 0;
    let height = 1;
    let frame = 0;
    const image = new Image();
    image.src = `/api/backgrounds/${photo.id}`;

    const sample = () => {
      if (!image.naturalWidth) return;
      height = screenHeight();
      rows = Math.max(1, Math.round(COLS * height / innerWidth));
      const canvas = document.createElement("canvas");
      canvas.width = COLS;
      canvas.height = rows;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      const scale = Math.max(COLS / image.naturalWidth, rows / image.naturalHeight);
      const drawnWidth = image.naturalWidth * scale, drawnHeight = image.naturalHeight * scale;
      context.drawImage(image, (COLS - drawnWidth) / 2, (rows - drawnHeight) / 2, drawnWidth, drawnHeight);
      const pixels = context.getImageData(0, 0, COLS, rows).data;
      const veil = theme === "light" ? 1 : 0;
      const band = Math.max(1, Math.round(rows * EDGE_SHARE));
      const average = (from: number, to: number) => {
        const sum = [0, 0, 0];
        for (let cell = from * COLS; cell < to * COLS; cell++) for (let channel = 0; channel < 3; channel++) sum[channel] += pixels[cell * 4 + channel];
        const count = (to - from) * COLS;
        return `rgb(${sum.map(total => Math.round(total / count * (1 - photo.dim) + veil * 255 * photo.dim)).join(" ")})`;
      };
      const edges = { id: photo.id, dim: photo.dim, theme, top: average(0, band), bottom: average(rows - band, rows) };
      const root = document.documentElement.style;
      root.setProperty("--edge-top", edges.top);
      root.setProperty("--edge-bottom", edges.bottom);
      root.setProperty("--page-floor", edges.bottom);
      try { localStorage.setItem(PHOTO_EDGES_KEY, JSON.stringify(edges)); } catch { /* storage full or blocked: the next load samples again */ }
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
        if (element.closest("[data-backed], [data-wall-chip]")) continue;
        const box = element.getBoundingClientRect();
        if (!box.width) continue;
        // A wall tablet scrolls <main> rather than the page, so its scroll counts too.
        const offset = pinned(element) ? 0 : scrollY + (document.querySelector("main")?.scrollTop ?? 0);
        const pageTop = box.top + offset, pageBottom = box.bottom + offset;
        const left = Math.max(0, Math.floor(box.left / innerWidth * COLS)), right = Math.min(COLS - 1, Math.floor(box.right / innerWidth * COLS));
        const top = Math.min(rows - 1, Math.max(0, Math.floor(pageTop / height * rows))), bottom = Math.min(rows - 1, Math.max(0, Math.floor(pageBottom / height * rows)));
        let total = 0, count = 0;
        for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) { total += grid[row * COLS + col]; count++; }
        if (count) element.dataset.ink = inkFor(total / count);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    // A phone's toolbars grow and shrink as it scrolls, which changes the height but not the photo behind: only a new width samples again.
    let seenWidth = innerWidth;
    const resize = () => {
      if (innerWidth === seenWidth && grid) return;
      seenWidth = innerWidth;
      sample();
      schedule();
    };

    image.onload = resize;
    addEventListener("resize", resize);
    // Text moves without a scroll too: a section opens, a list loads, a panel folds away.
    const changes = new MutationObserver(schedule);
    changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "data-open", "aria-expanded"] });
    const layout = new ResizeObserver(schedule);
    layout.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("resize", resize);
      changes.disconnect();
      layout.disconnect();
      for (const name of EDGE_VARS) document.documentElement.style.removeProperty(name);
      for (const element of document.querySelectorAll<HTMLElement>("[data-ink]")) delete element.dataset.ink;
    };
  }, [photo, theme]);
}

function pinned(element: HTMLElement) {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const { position } = getComputedStyle(node);
    if (position === "fixed" || position === "sticky") return true;
  }
  return false;
}
