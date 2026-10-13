import { backdropIsDark, darkenForNight } from "@/lib/backgrounds/palette";
import type { CustomGradient, PhotoBackground } from "@/lib/theme";

/** A gradient ready to store: its night colours worked out, so the bootstrap script can paint them before any code loads. */
export const withNight = (gradient: CustomGradient): CustomGradient => ({ ...gradient, night: gradient.colors.map(darkenForNight) });

export const styleOf = (gradient: CustomGradient) => gradient.style ?? "flowing";

/** The colours a gradient paints right now: darkened in dark mode when the person asked for that. */
export const shownColors = (gradient: CustomGradient, theme: "light" | "dark") => theme === "dark" && gradient.dimAtNight ? gradient.colors.map(darkenForNight) : gradient.colors;

/** Mirrors what the bootstrap script sets before paint, so edits show at once and survive a reload without a flash. */
export function applyGradientVars(gradient: CustomGradient, theme: "light" | "dark") {
  const root = document.documentElement;
  const colors = shownColors(gradient, theme);
  for (let index = 0; index < 4; index++) root.style.setProperty(`--m${index + 1}`, colors[index % colors.length]);
  root.style.setProperty("--gradient", `linear-gradient(180deg, ${colors.join(", ")})`);
  root.style.setProperty("--g-last", colors[colors.length - 1]);
  root.dataset.gradientStyle = styleOf(gradient);
  if (backdropIsDark(colors, styleOf(gradient))) root.dataset.backdrop = "dark";
  else delete root.dataset.backdrop;
}

/** Undoes the gradient-only state when another background takes over. */
export function clearGradientState() {
  const root = document.documentElement;
  delete root.dataset.backdrop;
  delete root.dataset.gradientStyle;
}

export function applyPhotoVars(photo: PhotoBackground) {
  const root = document.documentElement;
  root.style.setProperty("--photo", `url(/api/backgrounds/${photo.id})`);
  root.style.setProperty("--photo-blur", `${photo.blur}px`);
  root.style.setProperty("--photo-dim", String(photo.dim));
}
