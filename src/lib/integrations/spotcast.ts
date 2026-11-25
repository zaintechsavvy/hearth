import { LIKED } from "@/lib/spotify/items";

export interface SpotcastCall {
  service: string;
  data: Record<string, unknown>;
  /** Spotify plays the media once the call returns; otherwise the speaker only joins Spotify Connect, and Hearth plays it. */
  started: boolean;
}

/**
 * The Spotcast action that starts Spotify on an idle Google Cast speaker, which Spotify Connect cannot see until
 * something casts to it. Spotcast 6 has an action per kind of start and takes the config entry of the `account` to
 * use, or its default account; Spotcast 3 to 5 has `start`, which plays a URI or takes over what Spotify played last.
 * Null without Spotcast.
 */
export function spotcastCall(actions: Set<string>, entityId: string, media: { id: string; type: string } | null, shuffle: boolean, account?: string): SpotcastCall | null {
  const liked = media !== null && (media.id === LIKED || media.type === LIKED);
  if (actions.has("spotcast.play_media")) {
    const base = { media_player: { entity_id: entityId }, ...(account ? { account } : {}) };
    if (!media) return { service: "transfer_playback", data: base, started: true };
    if (liked) return { service: "play_liked_songs", data: { ...base, data: { shuffle } }, started: true };
    const context = /^spotify:track:/.test(media.id) && media.type.startsWith("spotify:") ? { track_context: media.type } : {};
    return { service: "play_media", data: { ...base, spotify_uri: media.id, data: { shuffle, ...context } }, started: true };
  }
  if (actions.has("spotcast.start")) {
    const uri = media && !liked ? media.id : null;
    return { service: "start", data: { entity_id: entityId, force_playback: true, shuffle, ...(uri ? { uri } : {}) }, started: uri !== null || !media };
  }
  return null;
}

/** How Home Assistant can start Spotify on an idle Google Cast speaker: Spotcast if it is there, then the Google Assistant SDK. */
export function wakeMethodOf(actions: Set<string>) {
  if (actions.has("spotcast.play_media") || actions.has("spotcast.start")) return "spotcast" as const;
  if (actions.has("google_assistant_sdk.send_text_command")) return "assistant" as const;
  return null;
}
