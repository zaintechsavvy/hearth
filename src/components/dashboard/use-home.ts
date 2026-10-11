"use client";

import useSWR from "swr";
import { applyCommand, type Device, type DeviceCommand } from "@/lib/devices/types";
import type { HomeSnapshot } from "@/lib/home";

const POLL_MS = 4000;

async function fetchHome(url: string): Promise<HomeSnapshot> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load your home.");
  return response.json();
}

function patch(snapshot: HomeSnapshot, id: string, command: DeviceCommand): HomeSnapshot {
  return { ...snapshot, devices: snapshot.devices.map(device => device.id === id ? applyCommand(device, command) : device) };
}

/** Polls the home and applies commands optimistically, rolling back if the device refuses. */
export function useHome() {
  const { data, error, isLoading, mutate } = useSWR<HomeSnapshot>("/api/home", fetchHome, { refreshInterval: POLL_MS, keepPreviousData: true });

  async function send(device: Device, command: DeviceCommand) {
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
      revalidate: true,
    });
  }

  return { home: data, error, isLoading, refresh: mutate, send };
}
