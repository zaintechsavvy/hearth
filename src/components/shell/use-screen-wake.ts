"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { WAKE_EVENT } from "@/components/dashboard/doorbell-call";
import type { Device } from "@/lib/devices/types";
import type { KeepAwake } from "@/lib/wall";

const TOUCHES = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
const ENTRY_COVERS = new Set(["garage", "gate", "door"]);
const ENTRY_SENSORS = new Set(["door", "garage", "opening"]);

/** The state of a device whose change is worth keeping the screen on for: an entry door, gate, garage, lock, or the alarm. */
function entryState(device: Device): string | null {
  if (!device.available) return null;
  if (device.kind === "cover" && ENTRY_COVERS.has(device.coverClass)) return device.state;
  if (device.kind === "lock" || device.kind === "alarm") return device.state;
  if (device.kind === "binary_sensor" && ENTRY_SENSORS.has(device.sensorClass)) return String(device.active);
  return null;
}

/**
 * Holds a screen wake lock while the wall tablet should stay lit. `always` holds it whenever the page shows; `in-use`
 * holds it for `minutes` after the last touch, wake, or entry change, then lets go so the tablet's own Auto-Lock
 * can turn the display off. No web page can turn it back on, so a change that comes in once the display is off is
 * only seen at the next wake.
 */
export function useScreenWake(mode: KeepAwake, minutes: number, devices: Device[] | undefined) {
  const [held, setHeld] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seen = useRef<Map<string, string> | null>(null);
  const holdMs = Math.max(1, minutes) * 60_000;
  const hold = useEffectEvent(() => {
    setHeld(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHeld(false), holdMs);
  });

  useEffect(() => {
    if (mode !== "in-use") return;
    const touched = () => hold();
    const shown = () => { if (document.visibilityState === "visible") hold(); };
    touched();
    for (const type of TOUCHES) window.addEventListener(type, touched, { passive: true });
    window.addEventListener(WAKE_EVENT, touched);
    document.addEventListener("visibilitychange", shown);
    return () => {
      clearTimeout(timer.current);
      for (const type of TOUCHES) window.removeEventListener(type, touched);
      window.removeEventListener(WAKE_EVENT, touched);
      document.removeEventListener("visibilitychange", shown);
    };
  }, [mode, holdMs]);

  useEffect(() => {
    if (!devices) return;
    const next = new Map<string, string>();
    let changed = false;
    for (const device of devices) {
      const state = entryState(device);
      if (state === null) continue;
      next.set(device.id, state);
      const before = seen.current?.get(device.id);
      if (before !== undefined && before !== state) changed = true;
    }
    seen.current = next;
    if (!changed || mode !== "in-use") return;
    const soon = setTimeout(hold, 0);
    return () => clearTimeout(soon);
  }, [devices, mode]);

  const wanted = mode === "always" || (mode === "in-use" && held);
  useEffect(() => {
    if (!wanted || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let asking = false;
    let done = false;
    // iPadOS drops the lock whenever the page is hidden, and some browsers refuse it before the first touch, so it is
    // asked for again each time the page shows and at any touch while it is not held.
    const request = () => {
      if (asking || document.visibilityState !== "visible" || (lock && !lock.released)) return;
      asking = true;
      void navigator.wakeLock.request("screen").then(sentinel => {
        if (done) void sentinel.release();
        else lock = sentinel;
      }).catch(() => {}).finally(() => { asking = false; });
    };
    request();
    document.addEventListener("visibilitychange", request);
    window.addEventListener("pointerup", request);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", request);
      window.removeEventListener("pointerup", request);
      void lock?.release();
    };
  }, [wanted]);
}
