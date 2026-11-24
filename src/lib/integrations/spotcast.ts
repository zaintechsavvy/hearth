import { LIKED } from "@/lib/spotify/items";

export interface SpotcastCall {
  service: string;
  data: Record<string, unknown>;
  /** Spotify plays the media once the call returns; otherwise the speaker only joins Spotify Connect, and Hearth plays it. */
  started: boolean;
}

/**
 * The Spotcast action that starts Spotify on an idle Google Cast speaker, which Spotify Connect cannot see until
 * something casts to it. Spotcast 6 has an action per kind of start; Spotcast 3 to 5 has `start`, which plays a URI or
 * takes over what Spotify played last. Null without Spotcast.
 */
export function spotcastCall(actions: Set<string>, entityId: string, media: { id: string; type: string } | null, shuffle: boolean): SpotcastCall | null {
  const liked = media !== null && (media.id === LIKED || media.type === LIKED);
  if (actions.has("spotcast.play_media")) {
    const media_player = { entity_id: entityId };
    if (!media) return { service: "transfer_playback", data: { media_player }, started: true };
    if (liked) return { service: "play_liked_songs", data: { media_player, data: { shuffle } }, started: true };
    const context = /^spotify:track:/.test(media.id) && media.type.startsWith("spotify:") ? { track_context: media.type } : {};
    return { service: "play_media", data: { media_player, spotify_uri: media.id, data: { shuffle, ...context } }, started: true };
  }
  if (actions.has("spotcast.start")) {
    const uri = media && !liked ? media.id : null;
    return { service: "start", data: { entity_id: entityId, force_playback: true, shuffle, ...(uri ? { uri } : {}) }, started: uri !== null || !media };
  }
  return null;
}
