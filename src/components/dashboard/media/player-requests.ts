"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/** The music tiles on screen, each with a way to open its player. */
const tiles = new Map<symbol, { deviceId: string; open: () => void }>();
const listeners = new Set<() => void>();
const changed = () => { for (const listener of listeners) listener(); };

/** Lets something outside the tile, such as the home's summary, open this tile's player. */
export function usePlayerRequests(deviceId: string, open: () => void) {
  const latest = useRef(open);
  useEffect(() => { latest.current = open; });
  useEffect(() => {
    const key = Symbol(deviceId);
    tiles.set(key, { deviceId, open: () => latest.current() });
    changed();
    return () => { tiles.delete(key); changed(); };
  }, [deviceId]);
}

/** Opens the player of a tile showing `deviceId`, or of the first music tile when none does. False with no music tile on screen. */
export function openPlayer(deviceId?: string) {
  const all = [...tiles.values()];
  const tile = all.find(entry => entry.deviceId === deviceId) ?? all[0];
  tile?.open();
  return Boolean(tile);
}

/** Whether any music tile is on screen to open. */
export const useCanOpenPlayer = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => tiles.size > 0, () => false);
