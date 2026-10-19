"use client";

import { useEffect } from "react";
import { loadBackground, saveBackground } from "@/lib/background-sync";
import { DEFAULT_WALLPAPER, GRADIENT_KEY, GRADIENTS_KEY, PHOTO_KEY, WALLPAPER_KEY, type SyncedBackground, type Wallpaper } from "@/lib/theme";
import { PREFERENCE_EVENT } from "./use-stored-json";

/** When this device last took the background from the server or gave it one, in the server's clock. */
const SAVED_AT_KEY = "hearth-background-saved-at";
const SAVE_DELAY_MS = 800;

const json = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const here = (): Omit<SyncedBackground, "savedAt"> => ({
  wallpaper: (localStorage.getItem(WALLPAPER_KEY) as Wallpaper | null) ?? DEFAULT_WALLPAPER,
  gradient: json(GRADIENT_KEY, null),
  gradients: json(GRADIENTS_KEY, []),
  photo: json(PHOTO_KEY, null),
});

const write = (key: string, value: unknown) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value));

/**
 * Keeps the background the same on every device someone signs in on. Each device still paints from its own copy
 * before any code loads; this brings that copy up to date on load and whenever the app comes back to the front,
 * and saves a change made here for the others. The newest save wins.
 */
export function BackgroundSync({ initial }: { initial: SyncedBackground | null }) {
  useEffect(() => {
    let shown = JSON.stringify(here());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const savedAt = () => Number(localStorage.getItem(SAVED_AT_KEY)) || 0;

    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const result = await saveBackground(here()).catch(() => null);
        if (result?.ok) localStorage.setItem(SAVED_AT_KEY, String(result.savedAt));
      }, SAVE_DELAY_MS);
    };
    const take = (remote: SyncedBackground | null) => {
      if (!remote) {
        if (localStorage.getItem(WALLPAPER_KEY)) save();
        return;
      }
      if (remote.savedAt <= savedAt()) return;
      localStorage.setItem(WALLPAPER_KEY, remote.wallpaper);
      write(GRADIENT_KEY, remote.gradient);
      write(GRADIENTS_KEY, remote.gradients);
      write(PHOTO_KEY, remote.photo);
      localStorage.setItem(SAVED_AT_KEY, String(remote.savedAt));
      document.documentElement.dataset.wallpaper = remote.wallpaper;
      shown = JSON.stringify(here());
      window.dispatchEvent(new Event(PREFERENCE_EVENT));
    };
    const changed = () => {
      const now = JSON.stringify(here());
      if (now === shown) return;
      shown = now;
      save();
    };
    const refresh = () => {
      if (!document.hidden) void loadBackground().then(take, () => undefined);
    };

    take(initial);
    window.addEventListener(PREFERENCE_EVENT, changed);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(PREFERENCE_EVENT, changed);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [initial]);
  return null;
}
