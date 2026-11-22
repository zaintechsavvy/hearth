import type { MediaItem } from "@/lib/integrations/types";
import type { Device, DeviceCommand, MediaPlayerDevice } from "./types";

/**
 * A place a player can play: one of its own outputs (Spotify Connect devices, Bluetooth, a receiver's inputs), the
 * player itself, a speaker it can group with, or another speaker in the home the music can move to.
 */
export interface Speaker {
  key: string;
  name: string;
  room: string | null;
  current: boolean;
  /** `output` is one of its own outputs; `move` plays the current music on `device` instead; `unreachable` cannot. */
  via: "self" | "output" | "group" | "move" | "unreachable";
  output?: string;
  device?: MediaPlayerDevice;
  /** Playing together with the player now, for `group`. */
  grouped?: boolean;
  /** Why it cannot play there, for `unreachable`. */
  reason?: string;
}

/** Spotify's own ids, which only Spotify and Spotify Connect speakers can play. */
export const isSpotifyMedia = (id: string) => /^spotify:/i.test(id);
const isSpotify = (device: MediaPlayerDevice) => device.platform === "spotify" || (device.media !== null && isSpotifyMedia(device.media.id));
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Media players worth showing as speakers: reachable, not hidden in their source, and not an account such as Spotify itself. */
export function homeSpeakers(devices: Device[]) {
  return devices.filter((device): device is MediaPlayerDevice => device.kind === "media_player" && device.available && !device.auxiliary && device.platform !== "spotify");
}

const spotifyReason = (name: string) => `Spotify cannot see ${name} yet. Play to it once from the Spotify app and it joins Spotify Connect, then it shows up here.`;

/** Every speaker in the home, as `device` can reach it, with a speaker its outputs already name listed once. */
export function speakersFor(device: MediaPlayerDevice, devices: Device[]): Speaker[] {
  const others = homeSpeakers(devices).filter(other => other.id !== device.id);
  const claimed = new Set<string>();
  const list: Speaker[] = device.outputs.map(output => {
    const match = others.find(other => same(other.name, output));
    if (match) claimed.add(match.id);
    return { key: `output:${output}`, name: output, room: match?.room ?? null, current: output === device.output, via: "output", output, device: match };
  });
  if (!device.outputs.length && device.platform !== "spotify") list.push({ key: `self:${device.id}`, name: device.name, room: device.room, current: true, via: "self", device });
  for (const other of others) {
    if (claimed.has(other.id)) continue;
    const base = { key: `device:${other.id}`, name: other.name, room: other.room, current: false, device: other };
    if (device.can.group && other.can.group && other.integrationId === device.integrationId) list.push({ ...base, via: "group", grouped: device.group.includes(other.id) });
    else if (isSpotify(device)) list.push({ ...base, via: "unreachable", reason: spotifyReason(other.name) });
    else if (!other.can.play) list.push({ ...base, via: "unreachable", reason: `${other.name} cannot be sent music from Hearth.` });
    else list.push({ ...base, via: "move" });
  }
  const rank = (speaker: Speaker) => (speaker.current ? 0 : speaker.grouped ? 1 : speaker.via === "unreachable" ? 3 : 2);
  return list.sort((a, b) => rank(a) - rank(b));
}

/** Where `device` plays now, for its "Playing on" button. Spotify is a service, not a speaker, so idle it asks for one. */
export const playingOn = (device: MediaPlayerDevice) =>
  device.group.length > 1 ? `${device.group.length} speakers` : device.output ?? (device.platform === "spotify" ? "Choose a speaker" : device.name);

/** Players with a music library to browse, Spotify first, then `device` itself. */
export function librariesFor(device: MediaPlayerDevice, devices: Device[]) {
  const players = devices.filter((other): other is MediaPlayerDevice => other.kind === "media_player" && other.available && Boolean(other.can.browse));
  const spotify = players.filter(other => other.platform === "spotify" && other.id !== device.id);
  return [...(device.can.browse ? [device] : []), ...spotify].sort((a, b) => Number(b.platform === "spotify") - Number(a.platform === "spotify"));
}

export type PlayPlan = { to: MediaPlayerDevice; command: DeviceCommand } | { error: string };

/**
 * How to play something from `library` on `device`. The library's own player plays it where it plays now; another
 * library plays it on `device` through one of its outputs that names it, or by `device` itself when it can.
 */
export function planPlay(item: MediaItem, library: MediaPlayerDevice, device: MediaPlayerDevice): PlayPlan {
  const command = { type: "playMedia", id: item.media.id, mediaType: item.media.type } as const;
  if (library.id === device.id) return { to: library, command };
  const output = library.outputs.find(name => same(name, device.name));
  if (output) return { to: library, command: { ...command, output } };
  if (!isSpotifyMedia(item.media.id) && device.can.play) return { to: device, command };
  return { error: library.platform === "spotify" ? spotifyReason(device.name) : `${library.name} cannot play on ${device.name}.` };
}
