import { applyCommand, deviceId, livePosition, type Device, type DeviceCommand, type MediaPlayerDevice, type TodoItem } from "@/lib/devices/types";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { IntegrationError, type DeviceList, type HistoryPoint, type Provider } from "./types";

const DEMO_CAMERA_PICTURES: Record<string, string> = { "front-camera": "front-door-doorbell.jpg", "backyard-camera": "backyard-wyze.jpg" };

interface DemoHome {
  devices: Map<string, Device>;
  lists: Map<string, TodoItem[]>;
  updatedAt: number;
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
const TRACKS = [
  { title: "Slow Tide", artist: "Harbor Lights", duration: 222, artwork: "/demo/covers/1.svg" },
  { title: "Paper Planes in June", artist: "Margo Vale", duration: 245, artwork: "/demo/covers/2.svg" },
  { title: "Night Bus", artist: "The Quiet Hours", duration: 198, artwork: "/demo/covers/3.svg" },
  { title: "Fieldnotes", artist: "Ada Rowe", duration: 176, artwork: "/demo/covers/4.svg" },
].map((track, index) => ({ ...track, media: { id: `demo:track:${index}`, type: "music" } }));

const trackIndex = (device: MediaPlayerDevice) => Math.max(0, TRACKS.findIndex(track => track.title === device.title));

function playTrack(device: MediaPlayerDevice, step: number, at = trackIndex(device) + step): MediaPlayerDevice {
  const track = TRACKS[((at % TRACKS.length) + TRACKS.length) % TRACKS.length];
  return { ...device, ...track, state: "playing", position: 0, positionAt: new Date().toISOString() };
}

const DEMO_CAN = { pause: true, seek: true, next: true, previous: true, volume: true, shuffle: true, repeat: true, group: true, play: true, queue: true };

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

export function seedDemoDevices(integrationId: string): Device[] {
  const base = (nativeId: string, name: string, room: string | null) => ({ id: deviceId(integrationId, nativeId), integrationId, name, room, available: true });
  return [
    { ...base("thermostat", "Living room", "Living room"), kind: "thermostat", unit: "C", current: 20.5, target: 22, min: 10, max: 30, step: 0.5, mode: "heat", modes: ["off", "heat", "cool", "auto"], action: "heating" },
    { ...base("kitchen-pendants", "Pendants", "Kitchen"), kind: "light", on: true, dimmable: true, brightness: 80, supportsColor: true, color: { hue: 32, saturation: 70 }, colorMode: "color", temperatureRange: { min: 2000, max: 6500 }, temperature: null },
    { ...base("living-lamp", "Floor lamp", "Living room"), kind: "light", on: true, dimmable: true, brightness: 45, supportsColor: true, color: { hue: 40, saturation: 50 }, colorMode: "white", temperatureRange: { min: 2200, max: 5000 }, temperature: 2700 },
    { ...base("porch", "Porch light", "Outside"), kind: "light", on: false, dimmable: false, brightness: 0, supportsColor: false, color: null, colorMode: null, temperatureRange: null, temperature: null },
    { ...base("bedroom-fan", "Ceiling fan", "Bedroom"), kind: "fan", on: true, adjustable: true, speed: 40 },
    { ...base("coffee", "Coffee machine", "Kitchen"), kind: "switch", on: false },
    { ...base("office-plug", "Desk", "Office"), kind: "switch", on: true },
    { ...base("bedside", "Bedside lamp", "Bedroom"), kind: "light", on: false, dimmable: true, brightness: 0, supportsColor: true, color: { hue: 265, saturation: 55 }, colorMode: "color", temperatureRange: { min: 2000, max: 6500 }, temperature: null },
    { ...base("tv", "Television", "Living room"), kind: "switch", on: false },
    { ...base("front-lock", "Front door", "Entry"), kind: "lock", state: "locked" },
    { ...base("garage", "Garage door", "Garage"), kind: "cover", coverClass: "garage", state: "closed", position: 0, canStop: true, canSetPosition: false },
    { ...base("back-door", "Back door", "Kitchen"), kind: "binary_sensor", sensorClass: "door", active: false },
    { ...base("back-door-battery", "Back door battery", "Kitchen"), kind: "sensor", sensorClass: "battery", value: 82, unit: "%" },
    { ...base("hall-temp", "Hallway", "Entry"), kind: "sensor", sensorClass: "temperature", value: 21.4, unit: "°C" },
    { ...base("living-humidity", "Living room humidity", "Living room"), kind: "sensor", sensorClass: "humidity", value: 44, unit: "%" },
    { ...base("bedroom-temp", "Bedroom", "Bedroom"), kind: "sensor", sensorClass: "temperature", value: 19.8, unit: "°C" },
    { ...base("bedroom-window", "Bedroom window", "Bedroom"), kind: "binary_sensor", sensorClass: "window", active: true },
    { ...base("hall-motion", "Hallway motion", "Entry"), kind: "binary_sensor", sensorClass: "motion", active: false },
    { ...base("sink-leak", "Under the sink", "Kitchen"), kind: "binary_sensor", sensorClass: "leak", active: false },
    { ...base("home-power", "Home power", null), kind: "sensor", sensorClass: "power", value: 640, unit: "W" },
    { ...base("home-energy", "Home energy", null), kind: "sensor", sensorClass: "energy", value: 1214.4, unit: "kWh" },
    { ...base("washer-power", "Washer power", "Laundry"), kind: "sensor", sensorClass: "power", value: 0, unit: "W" },
    { ...base("fridge-power", "Fridge power", "Kitchen"), kind: "sensor", sensorClass: "power", value: 85, unit: "W" },
    { ...base("tv-power", "TV power", "Living room"), kind: "sensor", sensorClass: "power", value: 112, unit: "W" },
    { ...base("front-door-battery", "Front door lock battery", "Entry"), kind: "sensor", sensorClass: "battery", value: 18, unit: "%" },
    { ...base("hall-motion-battery", "Hallway motion battery", "Entry"), kind: "sensor", sensorClass: "battery", value: 64, unit: "%" },
    { ...base("garden-sensor", "Garden sensor", "Outside"), kind: "sensor", sensorClass: "temperature", value: null, unit: "°C", available: false },
    { ...base("zain", "Zain", null), kind: "person", home: true, place: null, picture: null, since: new Date(Date.now() - 2.5 * 3_600_000).toISOString(), battery: 72 },
    { ...base("sam", "Sam", null), kind: "person", home: false, place: "Work", picture: null, since: new Date(Date.now() - 4 * 3_600_000).toISOString(), battery: 41 },
    { ...base("vacuum", "Robot vacuum", "Living room"), kind: "vacuum", state: "docked", battery: 100, can: { start: true, pause: true, stop: true, dock: true, locate: true } },
    { ...base("alarm", "Alarm", null), kind: "alarm", state: "disarmed", modes: ["home", "away", "night"], codeFormat: "number", codeToArm: false },
    { ...base("shopping", "Shopping list", null), kind: "todo", open: 3, can: { add: true, remove: true, check: true } },
    { ...base("doorbell", "Doorbell", "Entry"), kind: "event", eventClass: "doorbell", last: null },
    { ...base("front-camera", "Front door camera", "Entry"), kind: "camera", streamable: true },
    { ...base("backyard-camera", "Backyard", "Outside"), kind: "camera", streamable: true },
    { ...base("evening", "Evening", null), kind: "scene", variant: "scene" },
    {
      ...base("music", "Music", "Living room"), kind: "media_player", state: "playing", ...TRACKS[0], position: 52, positionAt: new Date().toISOString(),
      volume: 35, outputs: ["Living room speaker", "AirPods Pro", "Bose SoundLink Flex"], output: "Living room speaker", shuffle: false, repeat: "off", group: [],
      can: { ...DEMO_CAN, output: true },
    },
    {
      ...base("kitchen-speaker", "Kitchen speaker", "Kitchen"), kind: "media_player", state: "idle", title: null, artist: null, artwork: null, position: null, positionAt: null, duration: null,
      volume: 50, outputs: [], output: null, shuffle: false, repeat: "off", group: [], media: null,
      can: { ...DEMO_CAN, output: false },
    },
  ];
}

/** Moves each thermostat toward its setpoint since the last read, so the demo feels alive. */
function simulate(home: DemoHome, now: number) {
  const seconds = (now - home.updatedAt) / 1000;
  home.updatedAt = now;
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
    const heats = device.mode !== "off" && device.mode !== "cool" && goal > device.current + 0.05;
    const cools = device.mode !== "off" && device.mode !== "heat" && goal < device.current - 0.05;
    const drift = Math.min(Math.abs(goal - device.current), seconds * HEATING_RATE) * Math.sign(goal - device.current);
    const current = heats || cools || device.mode === "off" ? device.current + drift : device.current;
    home.devices.set(id, { ...device, current: Math.round(current * 10) / 10, action: device.mode === "off" ? "off" : heats ? "heating" : cools ? "cooling" : "idle" });
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

export class DemoProvider implements Provider {
  constructor(private readonly integrationId: string) {}

  private home() {
    let home = homes.get(this.integrationId);
    if (!home) {
      home = {
        devices: new Map(seedDemoDevices(this.integrationId).map(device => [device.id, device])), updatedAt: Date.now(), listeners: new Set(),
        lists: new Map([[deviceId(this.integrationId, "shopping"), ["Milk", "Eggs", "Coffee beans"].map(summary => ({ uid: summary.toLowerCase().replaceAll(" ", "-"), summary, done: false })).concat({ uid: "bread", summary: "Bread", done: true })]]),
      };
      homes.set(this.integrationId, home);
    }
    simulate(home, Date.now());
    return home;
  }

  async check() {}

  subscribe(onChange: () => void) {
    const home = this.home();
    home.listeners.add(onChange);
    home.timer ??= setInterval(() => {
      const before = JSON.stringify([...home.devices.values()]);
      simulate(home, Date.now());
      if (JSON.stringify([...home.devices.values()]) !== before) notify(home);
    }, TICK_MS);
    return () => {
      home.listeners.delete(onChange);
      if (home.listeners.size === 0 && home.timer) {
        clearInterval(home.timer);
        home.timer = undefined;
      }
    };
  }

  /** A believable day for demo readings: a gentle daily swing around the current value, with a little noise. */
  async history(nativeId: string, from: Date, to: Date): Promise<HistoryPoint[] | null> {
    const device = this.home().devices.get(deviceId(this.integrationId, nativeId));
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
    return { devices: [...this.home().devices.values()], unsupported: {} };
  }

  async todoItems(nativeId: string) {
    return this.home().lists.get(deviceId(this.integrationId, nativeId)) ?? [];
  }

  /** The demo playlist around the current track: the ones before it as recently played, and the next one up. */
  async mediaQueue(nativeId: string) {
    const device = this.home().devices.get(deviceId(this.integrationId, nativeId));
    if (device?.kind !== "media_player" || !device.title) return { recent: [], next: null };
    const at = trackIndex(device);
    const pick = (index: number) => { const track = TRACKS[(index + TRACKS.length) % TRACKS.length]; return { title: track.title, artist: track.artist, media: track.media }; };
    return { recent: [pick(at - 1), pick(at - 2), pick(at - 3)], next: pick(at + 1) };
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
      if (at >= 0) home.devices.set(leaderId, playTrack(leader, 0, at));
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
    const home = this.home();
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
      notify(home);
      return;
    }
    if (device.kind === "media_player") this.playMedia(home, device, command);
    else if (device.kind === "scene" && nativeId === "evening") this.evening(home);
    else home.devices.set(id, applyCommand(device, command));
    notify(home);
    if (device.kind === "cover" && command.type === "cover" && command.action !== "stop") {
      setTimeout(() => {
        const current = home.devices.get(id);
        if (current?.kind !== "cover" || current.state === "stopped") return;
        const open = command.action === "open";
        home.devices.set(id, { ...current, state: open ? "open" : "closed", position: open ? 100 : 0 });
        notify(home);
      }, TRAVEL_MS);
    }
  }
}
