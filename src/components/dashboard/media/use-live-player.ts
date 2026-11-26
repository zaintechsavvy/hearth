"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useHome } from "@/components/dashboard/use-home";
import { applyCommand, type DeviceCommand, type MediaPlayerDevice } from "@/lib/devices/types";
import { playsOn, spotifyControl, withPlayback, type QueuedTrack } from "@/lib/spotify/playback";
import { fetchJson, useSourceDevice, type Send } from "./media-hooks";
import { useSpotifyPlayback } from "./use-now-playing";

export const QUEUE_KEY = "/api/spotify/queue";
/**
 * A command shows at once and stays shown until a reading taken after Spotify accepted it shows it done, or this long
 * at most: Spotify often answers with the old volume or state for a second or two after it accepts a change.
 */
const SETTLE_MS = 400;
const GIVE_UP_MS = 6000;

const post = (body: unknown) => fetch("/api/spotify/player", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(response => {
  if (!response.ok) throw new Error();
});

interface Sent { command: DeviceCommand; at: number; settleAfter: number; upcoming?: QueuedTrack; from?: string | null }

/** What a command will look like once done; a skip shows the next song in Spotify's queue straight away. */
function predict(device: MediaPlayerDevice, { command, upcoming, at }: Sent): MediaPlayerDevice {
  const next = applyCommand(device, command);
  if (command.type !== "media" || command.action !== "next" || !upcoming) return next;
  return { ...next, title: upcoming.title, artist: upcoming.artist, album: null, artwork: upcoming.artwork ?? next.artwork, duration: upcoming.duration, position: 0, positionAt: new Date(at).toISOString(), media: { id: upcoming.uri, type: next.media?.type ?? "music" } };
}

/** Whether Spotify's reading shows the command done. A skip is done once another song plays; a seek once read after it. */
function done(live: MediaPlayerDevice, sent: Sent) {
  const { command } = sent;
  if (command.type === "media" && (command.action === "next" || command.action === "previous")) return (live.media?.id ?? null) !== sent.from;
  if (command.type === "seek") return true;
  if (command.type === "volume") return live.volume !== null && Math.abs(live.volume - command.value) <= 1;
  return JSON.stringify(applyCommand(live, command)) === JSON.stringify(live);
}

/**
 * The player kept current from Spotify itself while Spotify plays on it: read every second and a half while open,
 * every five seconds otherwise, and controlled through Spotify, falling back to the player's own integration.
 * Elsewhere the player is as its integration reports it.
 */
export function useLivePlayer(device: MediaPlayerDevice, send: Send, open: boolean) {
  const { home } = useHome();
  const source = useSourceDevice(device);
  const linked = Boolean(home?.spotifyLinked);
  const { data, mutate } = useSpotifyPlayback(linked && (device.platform === "spotify" || device.can.play), open ? 1500 : 5000);
  const spotify = data && playsOn(source, data.playback) ? data : null;
  const { data: queue } = useSWR<{ tracks?: QueuedTrack[] }>(spotify && open ? QUEUE_KEY : null, fetchJson, { refreshInterval: 6000, keepPreviousData: true });
  const [sent, setSent] = useState<Sent | null>(null);
  useEffect(() => {
    if (!sent) return;
    const timer = setTimeout(() => setSent(null), GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [sent]);

  const live = spotify?.playback ? withPlayback(device, spotify.playback, spotify.at) : device;
  const pending = sent && spotify && (spotify.at <= sent.settleAfter || !done(live, sent)) ? sent : null;
  const shown = pending ? predict(live, pending) : live;

  const liveSend: Send = async command => {
    const control = spotify ? spotifyControl(command) : null;
    if (!control) return send(command);
    const entry: Sent = { command, at: Date.now(), settleAfter: Infinity, upcoming: queue?.tracks?.[0], from: live.media?.id ?? null };
    setSent(entry);
    try {
      await post(control).catch(() => send(command));
    } finally {
      setSent(current => current?.command === command ? { ...entry, settleAfter: Date.now() + SETTLE_MS } : current);
      setTimeout(() => void mutate(), SETTLE_MS + 50);
      setTimeout(() => void mutate(), 1500);
      setTimeout(() => void mutate(), 3000);
    }
  };
  return { device: shown, send: liveSend, spotify: Boolean(spotify) };
}
