"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useHome } from "@/components/dashboard/use-home";
import { spotifySees, type SpeakerWake } from "@/lib/devices/speakers";
import type { MediaPlayerDevice } from "@/lib/devices/types";
import { handOff } from "@/lib/spotify/hand-off";
import { AsleepError, fetchJson, playOnSpotify } from "./media-hooks";
import { PLAYBACK_KEY } from "./use-now-playing";

export const WAKE_KEY = "/api/spotify/speakers";
const DONE_MS = 4000;

/** Which speakers Spotify Connect lists, and how Hearth wakes the idle Google Cast ones, read every 20 seconds. */
export function useSpeakerWake(enabled: boolean) {
  return useSWR<SpeakerWake>(enabled ? WAKE_KEY : null, fetchJson, { refreshInterval: 20_000, keepPreviousData: true, shouldRetryOnError: false }).data;
}

export interface Start {
  key: string;
  name: string;
  /** `listening` waits for someone to ask the speaker to play Spotify. */
  phase: "starting" | "listening" | "done" | "failed";
  /** Why Hearth is listening, when it tried to start the speaker itself first. */
  note?: string;
  error?: string;
}

type Body = Parameters<typeof playOnSpotify>[0];

/**
 * Starts Spotify on a speaker and says how it went. A Google speaker Hearth cannot start is asked for by voice: Hearth
 * watches Spotify Connect and plays the chosen music there the moment it appears. Once it plays, Spotify's playback
 * and the home are read again at once, and a moment later, so the player shows the speaker as soon as Spotify does.
 */
export function useSpotifyStart() {
  const { refresh } = useHome();
  const { mutate } = useSWRConfig();
  const [start, setStart] = useState<Start | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listening = useRef<AbortController>(undefined);
  useEffect(() => () => { clearTimeout(timer.current); listening.current?.abort(); }, []);

  const played = (key: string, name: string) => {
    setStart({ key, name, phase: "done" });
    const reread = () => { void mutate(PLAYBACK_KEY); void mutate(WAKE_KEY); void refresh(); };
    reread();
    setTimeout(reread, 1500);
    timer.current = setTimeout(() => setStart(current => current?.phase === "done" ? null : current), DONE_MS);
  };
  const failed = (key: string, name: string, failure: unknown) =>
    setStart({ key, name, phase: "failed", error: failure instanceof Error && failure.message ? failure.message : `${name} did not answer. Try again in a moment.` });

  const listen = async (key: string, name: string, speaker: MediaPlayerDevice, body: Body, note?: string) => {
    const abort = new AbortController();
    listening.current = abort;
    setStart({ key, name, phase: "listening", note });
    try {
      const outcome = await handOff({
        signal: abort.signal,
        sees: async () => spotifySees(speaker, (await fetchJson<{ names: string[] }>("/api/spotify/devices")).names),
        play: async () => {
          setStart({ key, name, phase: "starting" });
          await playOnSpotify({ ...body, device: undefined });
        },
      });
      if (outcome === "played") played(key, name);
      if (outcome === "timeout") setStart({ key, name, phase: "failed", error: `Did not hear from ${name}. Try again.` });
    } catch (failure) {
      failed(key, name, failure);
    }
  };

  /**
   * With `voice`, goes straight to asking for the speaker by voice, since Home Assistant has no way to start it.
   * `name` is what to call where it plays, the speaker's own name by default.
   */
  const run = async (key: string, speaker: MediaPlayerDevice, body: Body, { voice = false, name = speaker.name } = {}) => {
    clearTimeout(timer.current);
    listening.current?.abort();
    if (voice) return listen(key, name, speaker, body);
    setStart({ key, name, phase: "starting" });
    try {
      await playOnSpotify(body);
      played(key, name);
    } catch (failure) {
      if (failure instanceof AsleepError) return listen(key, name, speaker, body, failure.message);
      failed(key, name, failure);
    }
  };
  const cancel = () => { listening.current?.abort(); setStart(null); };
  return { start, run, cancel };
}
