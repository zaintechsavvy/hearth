import "server-only";
import { db } from "@/lib/db";
import { integration } from "@/lib/db/schema";
import type { Device } from "@/lib/devices/types";
import { loadHome, type HomeSnapshot } from "@/lib/home";
import { createProvider } from "@/lib/integrations/registry";

export interface HomeChange {
  userId: string;
  /** The devices as of the previous look, or null on the first. */
  before: Map<string, Device> | null;
  home: HomeSnapshot;
  after: Map<string, Device>;
  at: Date;
}

type ChangeHandler = (change: HomeChange) => unknown;
type TickHandler = (now: Date) => unknown;

interface Watch {
  userId: string;
  stops: Map<string, () => void>;
  devices: Map<string, Device> | null;
  pending?: ReturnType<typeof setTimeout>;
  running: boolean;
  again: boolean;
  last: number;
}

/** How often the list of connections is refreshed, picking up new ones and dropping removed ones. */
const DISCOVER_MS = 60_000;
/** How often every home is looked at even when nothing pushed a change, so readings keep coming and durations are noticed. */
const SWEEP_MS = 60_000;
const TICK_MS = 30_000;
/** The quickest a burst of pushed changes is evaluated again. */
const SETTLE_MS = 800;
/** Integrations that cannot push are polled this often. */
const POLL_MS = 30_000;

interface MonitorState {
  started: boolean;
  watches: Map<string, Watch>;
  changeHandlers: ChangeHandler[];
  tickHandlers: TickHandler[];
}

const registry = globalThis as unknown as { hearthMonitor?: MonitorState };
const state: MonitorState = registry.hearthMonitor ??= { started: false, watches: new Map(), changeHandlers: [], tickHandlers: [] };

/** Runs on every look at a home, with what changed since the last one. Register once at startup. */
export function onHomeChange(handler: ChangeHandler) {
  if (!state.changeHandlers.includes(handler)) state.changeHandlers.push(handler);
}

export function onTick(handler: TickHandler) {
  if (!state.tickHandlers.includes(handler)) state.tickHandlers.push(handler);
}

export const latestDevices = (userId: string) => state.watches.get(userId)?.devices ?? null;

async function evaluate(watch: Watch) {
  if (watch.running) {
    watch.again = true;
    return;
  }
  watch.running = true;
  try {
    const home = await loadHome(watch.userId);
    const after = new Map(home.devices.map(device => [device.id, device]));
    const change = { userId: watch.userId, before: watch.devices, home, after, at: new Date() };
    watch.devices = after;
    watch.last = Date.now();
    for (const handler of state.changeHandlers) {
      try {
        await handler(change);
      } catch (error) {
        console.error("Home monitor handler failed", error);
      }
    }
  } catch (error) {
    console.error("Home monitor could not load a home", error);
  } finally {
    watch.running = false;
    if (watch.again) {
      watch.again = false;
      schedule(watch);
    }
  }
}

function schedule(watch: Watch) {
  if (watch.pending) return;
  watch.pending = setTimeout(() => {
    watch.pending = undefined;
    void evaluate(watch);
  }, SETTLE_MS);
}

async function discover() {
  const rows = await db.select().from(integration);
  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(row.id);
    let watch = state.watches.get(row.userId);
    if (!watch) state.watches.set(row.userId, watch = { userId: row.userId, stops: new Map(), devices: null, running: false, again: false, last: 0 });
    if (watch.stops.has(row.id)) continue;
    const provider = createProvider(row);
    const changed = () => schedule(watch);
    if (provider.subscribe) watch.stops.set(row.id, provider.subscribe(changed));
    else {
      const timer = setInterval(changed, POLL_MS);
      watch.stops.set(row.id, () => clearInterval(timer));
    }
    schedule(watch);
  }
  for (const [userId, watch] of state.watches) {
    for (const [id, stop] of watch.stops) {
      if (seen.has(id)) continue;
      stop();
      watch.stops.delete(id);
    }
    if (watch.stops.size === 0 && !rows.some(row => row.userId === userId)) state.watches.delete(userId);
  }
}

/** Asks for a fresh look at one home soon, such as after a command or a settings change. */
export function nudge(userId: string) {
  const watch = state.watches.get(userId);
  if (watch) schedule(watch);
}

/**
 * Watches every home, whether or not anyone has a dashboard open, so history, the activity log, alerts, and
 * automations keep running. Started once per server process from `instrumentation.ts`.
 */
export function startMonitor() {
  if (state.started) return;
  state.started = true;
  const safely = (run: () => Promise<unknown>) => () => void run().catch(error => console.error("Home monitor failed", error));
  safely(discover)();
  setInterval(safely(discover), DISCOVER_MS).unref?.();
  setInterval(() => {
    const now = Date.now();
    for (const watch of state.watches.values()) if (now - watch.last >= SWEEP_MS) schedule(watch);
  }, SWEEP_MS / 2).unref?.();
  setInterval(() => {
    const now = new Date();
    for (const handler of state.tickHandlers) void Promise.resolve(handler(now)).catch(error => console.error("Home monitor tick failed", error));
  }, TICK_MS).unref?.();
}
