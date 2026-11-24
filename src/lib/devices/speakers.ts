import type { Device, MediaPlayerDevice } from "./types";

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
   * `output` is one of its own outputs; `move` plays the current music on `device` instead; `spotify` moves Spotify
   * to `device`, waking it into Spotify Connect first; `unreachable` cannot; `library` is Spotify listed among a
   * speaker's inputs, which opens Spotify's library rather than switching to it.
   */
  via: "self" | "output" | "group" | "move" | "spotify" | "unreachable" | "library";
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

const spotifyReason = (name: string) => `Connect Spotify in Settings and Hearth can start Spotify on ${name}, even while it is idle.`;

/**
 * Every speaker in the home, as `device` can reach it, with a speaker its outputs already name listed once. With
 * `library`, a speaker's own Spotify input leads to the Spotify library. With `linked`, the home's Spotify is
 * connected to Hearth, so Spotify moves to any speaker that plays, idle ones included, since Hearth wakes them.
 */
export function speakersFor(device: MediaPlayerDevice, devices: Device[], { library = false, linked = false } = {}): Speaker[] {
  const others = homeSpeakers(devices).filter(other => other.id !== device.id);
  const claimed = new Set<string>();
  const outputs = outputsOf(device);
  const list: Speaker[] = outputs.map(output => {
    const match = others.find(other => same(other.name, output));
    if (match) claimed.add(match.id);
    return { key: `output:${output}`, name: output, room: match?.room ?? null, current: output === device.output, via: "output", output, device: match };
  });
  if (library && device.platform !== "spotify" && device.outputs.some(output => /^spotify/i.test(output.trim()))) list.push({ key: "library:spotify", name: "Spotify", room: null, current: false, via: "library" });
  if (!outputs.length && device.platform !== "spotify") list.push({ key: `self:${device.id}`, name: device.name, room: device.room, current: true, via: "self", device });
  for (const other of others) {
    if (claimed.has(other.id)) continue;
    const base = { key: `device:${other.id}`, name: other.name, room: other.room, current: false, device: other };
    if (device.can.group && other.can.group && other.integrationId === device.integrationId) list.push({ ...base, via: "group", grouped: device.group.includes(other.id) });
    else if (!other.can.play) list.push({ ...base, via: "unreachable", reason: `${other.name} cannot be sent music from Hearth.` });
    else if (isSpotify(device)) list.push(linked ? { ...base, via: "spotify" } : { ...base, via: "unreachable", reason: spotifyReason(other.name) });
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

/**
 * The names to look for among Spotify Connect devices to play on `device`: the speaker's own, or for Home Assistant's
 * Spotify, the device it plays on now. None means wherever Spotify plays now.
 */
export const spotifyTargets = (device: MediaPlayerDevice) =>
  device.platform === "spotify" ? (device.output ? [device.output] : []) : [device.name, device.sourceName].filter((name): name is string => Boolean(name));

/** The speaker Hearth may wake when Spotify cannot see it yet: the player itself, unless it is Spotify's own account. */
export const wakeTarget = (device: MediaPlayerDevice) => device.platform === "spotify" ? undefined : device.id;
