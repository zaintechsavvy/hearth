"use client";

import { useEffect } from "react";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

/** The browser's install offer, kept from when it fired so a later Install button can use it. */
export const installPrompt = {
  get: () => deferred,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  async show() {
    const event = deferred;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    deferred = null;
    for (const listener of listeners) listener();
    return outcome === "accepted";
  },
};

/** Registers the service worker that gives an installed Hearth its offline page and notifications. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    const offered = (event: Event) => {
      event.preventDefault();
      deferred = event as InstallPrompt;
      for (const listener of listeners) listener();
    };
    window.addEventListener("beforeinstallprompt", offered);
    return () => window.removeEventListener("beforeinstallprompt", offered);
  }, []);
  return null;
}
