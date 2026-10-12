import { darkenForNight } from "@/lib/backgrounds/palette";
import type { CustomGradient, PhotoBackground } from "@/lib/theme";

/** A gradient ready to store: its night colours worked out, so the bootstrap script can paint them before any code loads. */
export const withNight = (gradient: CustomGradient): CustomGradient => ({ ...gradient, night: gradient.colors.map(darkenForNight) });

/** Mirrors what the bootstrap script sets before paint, so edits show at once and survive a reload without a flash. */
export function applyGradientVars(gradient: CustomGradient, theme: "light" | "dark") {
  const root = document.documentElement;
  const colors = theme === "dark" && gradient.dimAtNight ? gradient.colors.map(darkenForNight) : gradient.colors;
  for (let index = 0; index < 4; index++) root.style.setProperty(`--m${index + 1}`, colors[index % colors.length]);
}

export function applyPhotoVars(photo: PhotoBackground) {
  const root = document.documentElement;
  root.style.setProperty("--photo", `url(/api/backgrounds/${photo.id})`);
  root.style.setProperty("--photo-blur", `${photo.blur}px`);
  root.style.setProperty("--photo-dim", String(photo.dim));
}
