"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { applyCommand, type Device, type DeviceCommand } from "@/lib/devices/types";
import type { HomeSnapshot, SceneRun } from "@/lib/home";
import { applyScene, type HearthScene } from "@/lib/scenes/types";

const KEY = "/api/home";
const STREAM = "/api/home/stream";
/** Only while the live stream is down. */
const FALLBACK_POLL_MS = 15_000;

async function fetchHome(url: string): Promise<HomeSnapshot> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load your home.");
  return response.json();
}

function patch(snapshot: HomeSnapshot, id: string, command: DeviceCommand): HomeSnapshot {
  return { ...snapshot, devices: snapshot.devices.map(device => device.id === id ? applyCommand(device, command) : device) };
}

/**
 * The home, kept current by Server-Sent Events, with polling only as a fallback. Commands apply optimistically
 * and roll back if the device refuses; pushed snapshots wait until in-flight commands settle so a toggle never
 * flickers back to its old state.
 */
export function useHome() {
  const [live, setLive] = useState(false);
  const inFlight = useRef(0);
  const held = useRef<HomeSnapshot | null>(null);
  const { data, error, isLoading, mutate } = useSWR<HomeSnapshot>(KEY, fetchHome, { refreshInterval: live ? 0 : FALLBACK_POLL_MS, keepPreviousData: true });

  useEffect(() => {
    const source = new EventSource(STREAM);
    source.addEventListener("snapshot", event => {
      setLive(true);
      const snapshot = JSON.parse((event as MessageEvent<string>).data) as HomeSnapshot;
      if (inFlight.current > 0) held.current = snapshot;
      else void mutate(snapshot, { revalidate: false });
    });
    source.addEventListener("error", () => setLive(false));
    return () => source.close();
  }, [mutate]);

  const send = useCallback(async (device: Device, command: DeviceCommand) => {
    inFlight.current++;
    try {
      await mutate(async current => {
        const response = await fetch(`/api/devices/${encodeURIComponent(device.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "The device did not respond.");
        return current && patch(current, device.id, command);
      }, {
        optimisticData: current => current ? patch(current, device.id, command) : (current as unknown as HomeSnapshot),
        rollbackOnError: true,
        revalidate: false,
      });
    } finally {
      inFlight.current--;
      if (inFlight.current === 0 && held.current) {
        const snapshot = held.current;
        held.current = null;
        void mutate(snapshot, { revalidate: false });
      }
    }
  }, [mutate]);

  const runScene = useCallback(async (scene: HearthScene): Promise<SceneRun> => {
    inFlight.current++;
    try {
      let outcome: SceneRun = { ran: 0, failed: [] };
      await mutate(async current => {
        const response = await fetch(`/api/scenes/${scene.id}`, { method: "POST" });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "The scene did not run.");
        outcome = body as SceneRun;
        return current && { ...current, devices: applyScene(current.devices, scene.actions) };
      }, {
        optimisticData: current => current ? { ...current, devices: applyScene(current.devices, scene.actions) } : (current as unknown as HomeSnapshot),
        rollbackOnError: true,
        revalidate: false,
      });
      return outcome;
    } finally {
      inFlight.current--;
      if (inFlight.current === 0 && held.current) {
        const snapshot = held.current;
        held.current = null;
        void mutate(snapshot, { revalidate: false });
      }
    }
  }, [mutate]);

  return { home: data, error, isLoading, live, refresh: mutate, send, runScene };
}
