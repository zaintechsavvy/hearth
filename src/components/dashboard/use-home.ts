"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import useSWR, { mutate as mutateKey } from "swr";
import type { ActionResult } from "@/lib/action-helpers";
import { deleteWidgetItem, saveWidgetItem } from "@/lib/widget-actions";
import type { ItemData, ItemKind, WidgetItem } from "@/lib/widgets/items";
import { applyCommand, type Device, type DeviceCommand } from "@/lib/devices/types";
import { markSent } from "@/lib/sent-here";
import type { HomeSnapshot, SceneRun } from "@/lib/home";
import { applyScene, type HearthScene } from "@/lib/scenes/types";

const KEY = "/api/home";
const STREAM = "/api/home/stream";
/** Only while the live stream is down. */
const FALLBACK_POLL_MS = 15_000;

/** How long a connection that stops answering keeps its last devices on screen before Hearth says so. */
const STEADY_MS = 120_000;
const failingSince = new Map<string, number>();
let lastGood: HomeSnapshot | null = null;

/**
 * Rides out a connection missing one look, as a hosted Hearth's can when it reaches home slowly: its last devices
 * stay on the dashboard and the warning waits, unless the connection is still not answering two minutes on.
 */
function steady(next: HomeSnapshot): HomeSnapshot {
  const previous = lastGood;
  let devices = next.devices;
  let integrations = next.integrations;
  for (const integration of next.integrations) {
    if (integration.ok) {
      failingSince.delete(integration.id);
      continue;
    }
    const since = failingSince.get(integration.id) ?? Date.now();
    failingSince.set(integration.id, since);
    const kept = previous?.devices.filter(device => device.integrationId === integration.id) ?? [];
    if (Date.now() - since > STEADY_MS || kept.length === 0) continue;
    devices = [...devices, ...kept];
    integrations = integrations.map(item => item.id === integration.id ? { ...item, ok: true, error: null, deviceCount: kept.length } : item);
  }
  const result = devices === next.devices ? next : { ...next, devices, integrations };
  lastGood = result;
  return result;
}

async function fetchHome(url: string): Promise<HomeSnapshot> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load your home.");
  return steady(await response.json());
}

function patch(snapshot: HomeSnapshot, id: string, command: DeviceCommand): HomeSnapshot {
  return { ...snapshot, devices: snapshot.devices.map(device => device.id === id ? applyCommand(device, command) : device) };
}

/**
 * One live stream for the whole page, however many tiles read the home: each open stream rebuilds the home on the
 * server for every change, so a stream per tile made every change slow to arrive. Pushed snapshots wait while a
 * command is in flight, so a toggle never flickers back to its old state.
 */
const shared = { source: null as EventSource | null, users: 0, live: false, inFlight: 0, held: null as HomeSnapshot | null, listeners: new Set<() => void>() };

const notifyLive = (live: boolean) => {
  shared.live = live;
  for (const listener of shared.listeners) listener();
};

/** A tablet that slept, or a server that restarted, can leave the stream closed for good; waking the screen opens it again. */
function wake() {
  if (document.visibilityState !== "visible" || shared.users === 0) return;
  if (shared.source?.readyState === EventSource.CLOSED) {
    shared.source.close();
    shared.source = null;
    open();
  }
  void mutateKey(KEY);
}

function open() {
  if (!shared.source) {
    const source = new EventSource(STREAM);
    source.addEventListener("snapshot", event => {
      notifyLive(true);
      const snapshot = steady(JSON.parse((event as MessageEvent<string>).data) as HomeSnapshot);
      if (shared.inFlight > 0) shared.held = snapshot;
      else void mutateKey(KEY, snapshot, { revalidate: false });
    });
    source.addEventListener("error", () => notifyLive(false));
    shared.source = source;
  }
}

function connect() {
  shared.users++;
  if (shared.users === 1) {
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
  }
  open();
  return () => {
    shared.users--;
    if (shared.users > 0) return;
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("online", wake);
    shared.source?.close();
    shared.source = null;
    notifyLive(false);
  };
}

function settle() {
  shared.inFlight--;
  if (shared.inFlight === 0 && shared.held) {
    const snapshot = shared.held;
    shared.held = null;
    void mutateKey(KEY, snapshot, { revalidate: false });
  }
}

/** The home, kept current by Server-Sent Events, with polling only as a fallback. Commands and widget edits apply at once and roll back if they fail. */
export function useHome() {
  const live = useSyncExternalStore(listener => { shared.listeners.add(listener); return () => shared.listeners.delete(listener); }, () => shared.live, () => false);
  const { data, error, isLoading, mutate } = useSWR<HomeSnapshot>(KEY, fetchHome, { refreshInterval: live ? 0 : FALLBACK_POLL_MS, keepPreviousData: true });

  useEffect(() => connect(), []);

  /** Adds or edits a widget item, showing it straight away; the saved id replaces the stand-in once the server has it. */
  const saveItem = useCallback(async (kind: ItemKind, data: unknown, id?: string) => {
    const standIn = id ?? `pending-${crypto.randomUUID()}`;
    shared.inFlight++;
    try {
      await mutate(current => current && {
        ...current,
        widgets: id ? current.widgets.map(item => item.id === id ? { ...item, data: data as WidgetItem["data"] } : item)
          : [...current.widgets, { id: standIn, kind, data: data as WidgetItem["data"], position: Number.MAX_SAFE_INTEGER } as WidgetItem],
      }, { revalidate: false });
      const result = await saveWidgetItem(kind, data, id);
      if (result.ok) await mutate(current => current && { ...current, widgets: current.widgets.map(item => item.id === standIn ? { ...item, id: result.id } : item) }, { revalidate: false });
      else await mutate();
      return result;
    } finally {
      settle();
    }
  }, [mutate]);

  const removeItem = useCallback(async (id: string) => {
    shared.inFlight++;
    try {
      await mutate(current => current && { ...current, widgets: current.widgets.filter(item => item.id !== id) }, { revalidate: false });
      const result = await deleteWidgetItem(id);
      if (!result.ok) await mutate();
      return result;
    } finally {
      settle();
    }
  }, [mutate]);

  /** Runs a widget action, showing its effect on the item straight away and rolling back if the server refuses it. */
  const changeItem = useCallback(async <K extends ItemKind>(item: WidgetItem<K>, change: (data: ItemData<K>) => ItemData<K>, action: () => Promise<ActionResult>) => {
    shared.inFlight++;
    try {
      await mutate(current => current && { ...current, widgets: current.widgets.map(entry => entry.id === item.id ? { ...entry, data: change(entry.data as ItemData<K>) } : entry) }, { revalidate: false });
      const result = await action();
      if (!result.ok) await mutate();
      return result;
    } finally {
      settle();
    }
  }, [mutate]);

  const send = useCallback(async (device: Device, command: DeviceCommand, pin?: string) => {
    markSent(device.id);
    shared.inFlight++;
    try {
      await mutate(async current => {
        const response = await fetch(`/api/devices/${encodeURIComponent(device.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(pin ? { "X-Hearth-Pin": pin } : {}) },
          body: JSON.stringify(command),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "The device did not respond.");
        return current && patch(current, device.id, command);
      }, {
        // A change behind a PIN or an alarm code waits for the server to accept the code, so a wrong one never looks like it worked.
        ...(pin || (command.type === "alarm" && command.code) ? {} : { optimisticData: (current: HomeSnapshot | undefined) => current ? patch(current, device.id, command) : (current as unknown as HomeSnapshot) }),
        rollbackOnError: true,
        revalidate: false,
      });
    } finally {
      settle();
    }
  }, [mutate]);

  const runScene = useCallback(async (scene: HearthScene): Promise<SceneRun> => {
    markSent(...scene.actions.map(action => action.deviceId));
    shared.inFlight++;
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
      settle();
    }
  }, [mutate]);

  return { home: data, error, isLoading, live, refresh: mutate, send, runScene, saveItem, removeItem, changeItem };
}
