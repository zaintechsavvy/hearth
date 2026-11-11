import { applyCommand, deviceId, livePosition, type Device, type DeviceCommand, type MediaPlayerDevice, type TodoItem } from "@/lib/devices/types";
import "server-only";
import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/lib/db";
import { demoState } from "@/lib/db/schema";
import { DEMO_CAN, seedDemoDevices, TRACKS } from "./demo-devices";
import { browseLibrary, searchLibrary, songsOf } from "./demo-library";
import { IntegrationError, type DeviceList, type HistoryPoint, type Provider } from "./types";

const DEMO_CAMERA_PICTURES: Record<string, string> = { "front-camera": "front-door-doorbell.jpg", "backyard-camera": "backyard-wyze.jpg" };

interface DemoHome {
  devices: Map<string, Device>;
  lists: Map<string, TodoItem[]>;
  moving: Map<string, { at: number; open: boolean }>;
  updatedAt: number;
  /** The saved row this copy matches; a higher one in the database means another instance changed the home. */
  version: number;
  listeners: Set<() => void>;
  timer?: ReturnType<typeof setInterval>;
}

const registry = globalThis as unknown as { hearthDemoHomes?: Map<string, DemoHome> };
const homes = registry.hearthDemoHomes ??= new Map();

/** Degrees per second the simulated room moves toward its setpoint. */
const HEATING_RATE = 0.02;
const AMBIENT = 20.5;
/** How often a watched demo home advances its simulation and pushes the result. */
const TICK_MS = 5000;
/** How long the demo garage door takes to travel. */
const TRAVEL_MS = 3000;

/** An original playlist with abstract covers, so the demo player has something to show. */
const trackIndex = (device: MediaPlayerDevice) => Math.max(0, TRACKS.findIndex(track => track.title === device.title));

function playTrack(device: MediaPlayerDevice, step: number, at = trackIndex(device) + step): MediaPlayerDevice {
  const track = TRACKS[((at % TRACKS.length) + TRACKS.length) % TRACKS.length];
  return { ...device, ...track, state: "playing", position: 0, positionAt: new Date().toISOString() };
}


/** Grouped players play the leader's track, so every member follows a change to it. */
function followLeader(home: DemoHome, leaderId: string) {
  const leader = home.devices.get(leaderId);
  if (leader?.kind !== "media_player") return;
  for (const memberId of leader.group.slice(1)) {
    const member = home.devices.get(memberId);
    if (member?.kind !== "media_player") continue;
    const { title, artist, artwork, duration, position, positionAt, state, media, shuffle, repeat } = leader;
    home.devices.set(memberId, { ...member, title, artist, artwork, duration, position, positionAt, state, media, shuffle, repeat, group: leader.group });
  }
}


/** Moves each thermostat toward its setpoint since the last read, so the demo feels alive. */
function simulate(home: DemoHome, now: number) {
  const seconds = (now - home.updatedAt) / 1000;
  home.updatedAt = now;
  for (const [id, move] of home.moving) {
    const cover = home.devices.get(id);
    if (now - move.at < TRAVEL_MS && cover?.kind === "cover" && cover.state !== "stopped") continue;
    home.moving.delete(id);
    if (cover?.kind === "cover" && cover.state !== "stopped") home.devices.set(id, { ...cover, state: move.open ? "open" : "closed", position: move.open ? 100 : 0 });
  }
  for (const [id, device] of home.devices) {
    if (device.kind === "vacuum" && device.state === "cleaning") home.devices.set(id, { ...device, battery: Math.max(15, (device.battery ?? 100) - seconds * 0.05) | 0 });
    if (device.kind === "vacuum" && device.state === "returning") home.devices.set(id, { ...device, state: "docked" });
    if (device.kind === "vacuum" && device.state === "docked" && (device.battery ?? 100) < 100) home.devices.set(id, { ...device, battery: Math.min(100, (device.battery ?? 0) + Math.ceil(seconds * 0.2)) });
    if (device.kind === "alarm" && device.state === "arming") home.devices.set(id, { ...device, state: "armed_away" });
    if (device.kind === "media_player" && device.group[0] !== undefined && device.group[0] !== id) continue;
    if (device.kind === "media_player" && device.state === "playing" && device.duration && (livePosition(device, now) ?? 0) >= device.duration) {
      home.devices.set(id, device.repeat === "one" ? playTrack(device, 0) : playTrack(device, 1));
      followLeader(home, id);
    }
    if (device.kind !== "thermostat" || device.current === null) continue;
    const goal = device.mode === "off" || device.target === null ? AMBIENT : device.target;
    const heats = (device.mode === "heat" || device.mode === "auto") && goal > device.current + 0.05;
    const cools = (device.mode === "cool" || device.mode === "auto") && goal < device.current - 0.05;
    const drift = Math.min(Math.abs(goal - device.current), seconds * HEATING_RATE) * Math.sign(goal - device.current);
    const current = heats || cools || device.mode === "off" ? device.current + drift : device.current;
    const action = device.mode === "off" ? "off" : device.mode === "dry" ? "drying" : device.mode === "fan" ? "fan" : heats ? "heating" : cools ? "cooling" : "idle";
    home.devices.set(id, { ...device, current: Math.round(current * 10) / 10, action });
  }
}

function notify(home: DemoHome) {
  for (const listener of home.listeners) listener();
}

/**
 * Believable use: energy counts up through the day from a running total, the washer ran a cycle that ended about
 * 35 minutes ago, and other power readings hover around their current draw.
 */
function demoUsage(nativeId: string, current: number, from: Date, to: Date): HistoryPoint[] {
  const step = Math.max(5 * 60_000, (to.getTime() - from.getTime()) / 288);
  const midnight = new Date(to); midnight.setHours(0, 0, 0, 0);
  const points: HistoryPoint[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += step) {
    let v: number;
    if (nativeId === "home-energy") {
      // A running total: 9.4 kWh so far today, about 14 a day before that.
      const atMidnight = current - 9.4;
      v = t < midnight.getTime() ? atMidnight - (midnight.getTime() - t) / 86_400_000 * 14 : atMidnight + (t - midnight.getTime()) / Math.max(1, to.getTime() - midnight.getTime()) * 9.4;
    } else if (nativeId === "washer-power") {
      const ago = (to.getTime() - t) / 60_000;
      v = ago > 35 && ago < 125 ? Math.round(350 + Math.abs(Math.sin(ago / 7)) * 1700) : 0;
    } else {
      v = Math.max(0, current + Math.sin(t / 2_400_000) * current * 0.25);
    }
    points.push({ t, v: Math.round(v * 10) / 10 });
  }
  return points;
}

/** Device maps already filled in from the seed. */
const filled = new WeakSet<Map<string, Device>>();

export class DemoProvider implements Provider {
  constructor(private readonly integrationId: string) {}

  private seed(): DemoHome {
    return {
      devices: new Map(seedDemoDevices(this.integrationId).map(device => [device.id, device])), moving: new Map(), updatedAt: Date.now(), version: 0, listeners: new Set(),
      lists: new Map([[deviceId(this.integrationId, "shopping"), ["Milk", "Eggs", "Coffee beans"].map(summary => ({ uid: summary.toLowerCase().replaceAll(" ", "-"), summary, done: false })).concat({ uid: "bread", summary: "Bread", done: true })]]),
    };
  }

  /** This instance's copy of the home, refreshed from the database when another instance saved a newer one. */
  private async home() {
    let home = homes.get(this.integrationId);
    if (!home) homes.set(this.integrationId, home = this.seed());
    const [row] = await db.select().from(demoState).where(eq(demoState.integrationId, this.integrationId)).catch(() => []);
    if (row && row.version > home.version) {
      home.devices = new Map(row.devices.map(device => [device.id, device]));
      home.lists = new Map(Object.entries(row.lists));
      home.moving = new Map(Object.entries(row.moving));
      home.updatedAt = row.updatedAt.getTime();
      home.version = row.version;
    }
    this.fillIn(home);
    simulate(home, Date.now());
    return home;
  }

  /** A home saved, or kept in memory, before a device gained new details takes them from the seed, so it never lacks one. */
  private fillIn(home: DemoHome) {
    if (filled.has(home.devices)) return;
    const seeded = new Map(seedDemoDevices(this.integrationId).map(device => [device.id, device]));
    for (const [id, device] of home.devices) {
      const seed = seeded.get(id);
      if (seed) home.devices.set(id, { ...seed, ...device, ...("can" in seed && "can" in device ? { can: { ...seed.can, ...device.can } } : {}) } as Device);
    }
    filled.add(home.devices);
  }

  private async save(home: DemoHome) {
    home.version += 1;
    const values = { devices: [...home.devices.values()], lists: Object.fromEntries(home.lists), moving: Object.fromEntries(home.moving), updatedAt: new Date(home.updatedAt), version: home.version };
    await db.insert(demoState).values({ integrationId: this.integrationId, ...values })
      .onConflictDoUpdate({ target: demoState.integrationId, set: values }).catch(() => {});
  }

  async check() {}

  subscribe(onChange: () => void) {
    let home = homes.get(this.integrationId);
    if (!home) homes.set(this.integrationId, home = this.seed());
    const watched = home;
    watched.listeners.add(onChange);
    watched.timer ??= setInterval(async () => {
      const before = JSON.stringify([...watched.devices.values()]);
      const version = watched.version;
      await this.home();
      if (JSON.stringify([...watched.devices.values()]) === before) return;
      if (watched.version === version) await this.save(watched);
      notify(watched);
    }, TICK_MS);
    return () => {
      watched.listeners.delete(onChange);
      if (watched.listeners.size === 0 && watched.timer) {
        clearInterval(watched.timer);
        watched.timer = undefined;
      }
    };
  }

  /** A believable day for demo readings: a gentle daily swing around the current value, with a little noise. */
  async history(nativeId: string, from: Date, to: Date): Promise<HistoryPoint[] | null> {
    const device = (await this.home()).devices.get(deviceId(this.integrationId, nativeId));
    const current = device?.kind === "sensor" ? device.value : device?.kind === "thermostat" ? device.current : null;
    if (current === null || current === undefined) return null;
    if (device?.kind === "sensor" && (device.sensorClass === "energy" || device.sensorClass === "power")) return demoUsage(nativeId, current, from, to);
    const swing = device?.kind === "sensor" && device.sensorClass === "humidity" ? 6 : device?.kind === "sensor" && device.sensorClass === "battery" ? 0 : 1.6;
    const step = Math.max(5 * 60_000, (to.getTime() - from.getTime()) / 288);
    const points: HistoryPoint[] = [];
    for (let t = from.getTime(); t <= to.getTime(); t += step) {
      const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
      const daily = Math.sin((hour - 9) / 24 * Math.PI * 2) * swing;
      const noise = Math.sin(t / 3_600_000 * 1.7) * swing * 0.15;
      const drain = device?.kind === "sensor" && device.sensorClass === "battery" ? (to.getTime() - t) / 86_400_000 * 0.4 : 0;
      points.push({ t, v: Math.round((current + daily + noise + drain) * 10) / 10 });
    }
    return points;
  }

  async listDevices(): Promise<DeviceList> {
    return { devices: [...(await this.home()).devices.values()], unsupported: {} };
  }

  async todoItems(nativeId: string) {
    return (await this.home()).lists.get(deviceId(this.integrationId, nativeId)) ?? [];
  }

  /** The demo playlist around the current track: the ones before it as recently played, and the next one up. */
  async mediaQueue(nativeId: string) {
    const device = (await this.home()).devices.get(deviceId(this.integrationId, nativeId));
    if (device?.kind !== "media_player" || !device.title) return { recent: [], next: null };
    const at = trackIndex(device);
    const pick = (index: number) => { const track = TRACKS[(index + TRACKS.length) % TRACKS.length]; return { title: track.title, artist: track.artist, media: track.media }; };
    return { recent: [pick(at - 1), pick(at - 2), pick(at - 3)], next: pick(at + 1) };
  }

  async vacuumAreas() {
    return ["Living room", "Kitchen", "Bedroom", "Office", "Entry"].map(name => ({ id: name.toLowerCase().replaceAll(" ", "_"), name }));
  }

  async searchMedia(_nativeId: string, query: string) {
    return searchLibrary(query);
  }

  async browseMedia(_nativeId: string, media: { id: string }) {
    const found = browseLibrary(media.id);
    if (!found) throw new IntegrationError("That is not in the demo's music.");
    return found;
  }

  /** The demo's Evening scene: low warm lights, the porch on, and the coffee machine off. */
  private evening(home: DemoHome) {
    const set = (nativeId: string, command: DeviceCommand) => {
      const id = deviceId(this.integrationId, nativeId);
      const target = home.devices.get(id);
      if (target) home.devices.set(id, applyCommand(target, command));
    };
    set("kitchen-pendants", { type: "brightness", value: 30 });
    set("living-lamp", { type: "brightness", value: 25 });
    set("porch", { type: "power", on: true });
    set("coffee", { type: "power", on: false });
  }

  private playMedia(home: DemoHome, device: MediaPlayerDevice, command: DeviceCommand) {
    const leaderId = device.group[0] ?? device.id;
    const leader = (home.devices.get(leaderId) ?? device) as MediaPlayerDevice;
    if (command.type === "media" && (command.action === "next" || command.action === "previous")) {
      // Previous restarts a track a few seconds in, like a real player, and goes back one only near the start.
      const back = command.action === "previous" && (livePosition(leader) ?? 0) > 3 ? 0 : -1;
      home.devices.set(leaderId, playTrack(leader, command.action === "next" ? 1 : back));
    } else if (command.type === "playMedia") {
      const at = TRACKS.findIndex(track => track.media.id === command.id);
      const song = songsOf(command.id)[0];
      if (at >= 0) home.devices.set(leaderId, playTrack(leader, 0, at));
      else if (song) home.devices.set(leaderId, { ...leader, title: song.title, artist: song.artist, duration: song.duration, artwork: song.artwork, media: song.media, state: "playing", position: 0, positionAt: new Date().toISOString() });
    } else if (command.type === "join") {
      home.devices.set(device.id, applyCommand(device, command));
    } else if (command.type === "unjoin") {
      const rest = device.group.filter(member => member !== device.id);
      home.devices.set(device.id, { ...device, group: [] });
      for (const member of rest) {
        const other = home.devices.get(member);
        if (other?.kind === "media_player") home.devices.set(member, { ...other, group: rest.length > 1 ? rest : [] });
      }
      return;
    } else {
      home.devices.set(command.type === "volume" || command.type === "output" ? device.id : leaderId, applyCommand(command.type === "volume" || command.type === "output" ? device : leader, command));
    }
    followLeader(home, leaderId);
  }

  /** The demo's cameras show a still from the samples Hearth ships with; they have no video to stream. */
  async camera(nativeId: string) {
    const file = DEMO_CAMERA_PICTURES[nativeId];
    if (!file) return new Response(null, { status: 404 });
    const picture = await readFile(join(process.cwd(), "public", "samples", file));
    return new Response(new Uint8Array(picture), { headers: { "Content-Type": "image/jpeg" } });
  }

  async execute(nativeId: string, command: DeviceCommand) {
    const home = await this.home();
    const id = deviceId(this.integrationId, nativeId);
    const device = home.devices.get(id);
    if (!device) throw new IntegrationError("That demo device does not exist.");
    await new Promise(resolve => setTimeout(resolve, 180));
    if (command.type === "alarm" && device.kind === "alarm" && command.action === "disarm" && command.code !== "1234") throw new IntegrationError("That code is not right. The demo alarm's code is 1234.");
    if (command.type === "todo") {
      const items: TodoItem[] = home.lists.get(id) ?? [];
      const next: TodoItem[] = command.action === "add" ? [{ uid: crypto.randomUUID(), summary: command.item, done: false }, ...items]
        : command.action === "remove" ? items.filter(item => item.uid !== command.item)
        : items.map(item => item.uid === command.item ? { ...item, done: command.action === "check" } : item);
      home.lists.set(id, next);
      home.devices.set(id, { ...device, open: next.filter(item => !item.done).length } as Device);
      await this.save(home);
      notify(home);
      return;
    }
    if (device.kind === "media_player") this.playMedia(home, device, command);
    else if (device.kind === "scene" && nativeId === "evening") this.evening(home);
    else home.devices.set(id, applyCommand(device, command));
    if (device.kind === "cover" && command.type === "cover") {
      if (command.action === "stop") home.moving.delete(id);
      else home.moving.set(id, { at: Date.now(), open: command.action === "open" });
    }
    await this.save(home);
    notify(home);
  }
}
