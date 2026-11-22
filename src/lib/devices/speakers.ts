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
  /**
   * `output` is one of its own outputs; `move` plays the current music on `device` instead; `unreachable` cannot;
   * `library` is Spotify listed among a speaker's inputs, which opens Spotify's library rather than switching to it.
   */
  via: "self" | "output" | "group" | "move" | "unreachable" | "library";
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

const SERVICES = /^(spotify( connect)?|apple music|amazon( music)?|tunein( radio)?|pandora|deezer|tidal|soundcloud|youtube( music)?|iheart ?radio|napster|qobuz|sirius ?xm|plex|audible|air ?play( ?2)?|chromecast( built-in)?|google cast|alexa|music assistant|internet radio|net ?radio|online music|bbc sounds|radio ?paradise)$/i;
/** App and service names some speakers list among their inputs. Choosing one opens the app on the speaker, which plays nothing. */
export const isService = (source: string) => SERVICES.test(source.trim());
/** Where a player can send its sound: Spotify's Spotify Connect devices, or any other player's inputs that are not apps. */
export const outputsOf = (device: MediaPlayerDevice) => device.platform === "spotify" ? device.outputs : device.outputs.filter(output => !isService(output));

/** Media players worth showing as speakers: reachable, not hidden in their source, and not an account such as Spotify itself. */
export function homeSpeakers(devices: Device[]) {
  return devices.filter((device): device is MediaPlayerDevice => device.kind === "media_player" && device.available && !device.auxiliary && device.platform !== "spotify");
}

const spotifyReason = (name: string) => `Spotify cannot see ${name} yet. Play to it once from the Spotify app and it joins Spotify Connect, then it shows up here.`;

/**
 * Every speaker in the home, as `device` can reach it, with a speaker its outputs already name listed once. With
 * `spotify`, a Spotify library the home can open, a speaker's own Spotify input leads to it.
 */
export function speakersFor(device: MediaPlayerDevice, devices: Device[], spotify = false): Speaker[] {
  const others = homeSpeakers(devices).filter(other => other.id !== device.id);
  const claimed = new Set<string>();
  const outputs = outputsOf(device);
  const list: Speaker[] = outputs.map(output => {
    const match = others.find(other => same(other.name, output));
    if (match) claimed.add(match.id);
    return { key: `output:${output}`, name: output, room: match?.room ?? null, current: output === device.output, via: "output", output, device: match };
  });
  if (spotify && device.platform !== "spotify" && device.outputs.some(output => /^spotify/i.test(output.trim()))) list.push({ key: "library:spotify", name: "Spotify", room: null, current: false, via: "library" });
  if (!outputs.length && device.platform !== "spotify") list.push({ key: `self:${device.id}`, name: device.name, room: device.room, current: true, via: "self", device });
  for (const other of others) {
    if (claimed.has(other.id)) continue;
    const base = { key: `device:${other.id}`, name: other.name, room: other.room, current: false, device: other };
    if (device.can.group && other.can.group && other.integrationId === device.integrationId) list.push({ ...base, via: "group", grouped: device.group.includes(other.id) });
    else if (isSpotify(device)) list.push({ ...base, via: "unreachable", reason: spotifyReason(other.name) });
    else if (!other.can.play) list.push({ ...base, via: "unreachable", reason: `${other.name} cannot be sent music from Hearth.` });
    else list.push({ ...base, via: "move" });
  }
  const rank = (speaker: Speaker) => (speaker.current ? 0 : speaker.grouped || speaker.via === "library" ? 1 : speaker.via === "unreachable" ? 3 : 2);
  return list.sort((a, b) => rank(a) - rank(b));
}

/** Where `device` plays now, for its "Playing on" button. Spotify is a service, not a speaker, so idle it asks for one. */
export function playingOn(device: MediaPlayerDevice) {
  if (device.group.length > 1) return `${device.group.length} speakers`;
  const output = device.output && (device.platform === "spotify" || !isService(device.output)) ? device.output : null;
  return output ?? (device.platform === "spotify" ? "Choose a speaker" : device.name);
}

/** Music to browse: a player's own library, or Spotify signed in from Hearth, which has no player of its own. */
export interface Library {
  id: string;
  name: string;
  device: MediaPlayerDevice | null;
  search: boolean;
  shuffle: boolean;
  /** Home Assistant's Spotify opens its library only while it is playing somewhere; idle it refuses. */
  asleep: boolean;
}

export const SPOTIFY_LIBRARY: Library = { id: "spotify", name: "Spotify", device: null, search: true, shuffle: true, asleep: false };

const libraryOf = (player: MediaPlayerDevice): Library => ({
  id: player.id, name: player.platform === "spotify" ? "Spotify" : player.name, device: player,
  search: Boolean(player.can.search), shuffle: player.can.shuffle, asleep: player.platform === "spotify" && !player.can.browse,
});

/**
 * Libraries `device` can play from, Spotify first, then its own. Spotify signed in from Hearth (`linked`) stands in for
 * Home Assistant's, which cannot search and shuts its library while idle. Home Assistant's Spotify reports no browsing
 * while idle, yet it is still the home's Spotify, so it is listed asleep rather than dropped.
 */
export function librariesFor(device: MediaPlayerDevice, devices: Device[], linked = false): Library[] {
  const isLibrary = (player: MediaPlayerDevice) => player.platform === "spotify" ? !linked : Boolean(player.can.browse);
  const spotify = devices.filter((other): other is MediaPlayerDevice => other.kind === "media_player" && other.available && other.platform === "spotify" && other.id !== device.id && isLibrary(other));
  return [...(linked ? [SPOTIFY_LIBRARY] : []), ...spotify.map(libraryOf), ...(isLibrary(device) ? [libraryOf(device)] : [])]
    .sort((a, b) => Number(b.name === "Spotify") - Number(a.name === "Spotify"));
}

export const libraryUrl = (library: Library, what: "browse" | "search") =>
  library.device ? `/api/devices/${encodeURIComponent(library.device.id)}/media/${what}` : `/api/spotify/${what}`;

/** A command for a player, or for Spotify signed in from Hearth, the names to look for among its Spotify Connect devices. */
export type PlayPlan = { to: MediaPlayerDevice; command: DeviceCommand } | { spotify: string[] } | { error: string };

/**
 * How to play something from `library` on `device`. Spotify signed in from Hearth plays on the Spotify Connect device
 * that shares the speaker's name, or for Home Assistant's Spotify, the one it plays on now. The library's own player
 * plays it where it plays now; another library plays it on `device` through one of its outputs that names it, or by
 * `device` itself when it can.
 */
export function planPlay(item: MediaItem, library: Library, device: MediaPlayerDevice): PlayPlan {
  if (!library.device) return { spotify: device.platform === "spotify" ? (device.output ? [device.output] : []) : [device.name, device.sourceName].filter((name): name is string => Boolean(name)) };
  const source = library.device;
  const command = { type: "playMedia", id: item.media.id, mediaType: item.media.type } as const;
  if (source.id === device.id) return { to: source, command };
  const output = source.outputs.find(name => same(name, device.name));
  if (output) return { to: source, command: { ...command, output } };
  if (!isSpotifyMedia(item.media.id) && device.can.play) return { to: device, command };
  return { error: source.platform === "spotify" ? spotifyReason(device.name) : `${source.name} cannot play on ${device.name}.` };
}
