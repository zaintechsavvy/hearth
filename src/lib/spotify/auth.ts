import { createHash, randomBytes } from "node:crypto";

/** Reading playlists and the library, and seeing and moving what plays. */
export const SPOTIFY_SCOPES = ["playlist-read-private", "playlist-read-collaborative", "user-library-read", "user-follow-read", "user-read-playback-state", "user-modify-playback-state"];

/** Holds the PKCE verifier between sending someone to Spotify and Spotify sending them back. */
export const SIGN_IN_COOKIE = "hearth_spotify_sign_in";

export const isClientId = (value: string) => /^[0-9a-f]{32}$/i.test(value);

export function pkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function authorizeUrl({ clientId, redirectUri, challenge, state }: { clientId: string; redirectUri: string; challenge: string; state: string }) {
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, scope: SPOTIFY_SCOPES.join(" "), redirect_uri: redirectUri, code_challenge_method: "S256", code_challenge: challenge, state });
  return `https://accounts.spotify.com/authorize?${params}`;
}

/** Where Hearth lives: BETTER_AUTH_URL, then Vercel's production address, then the address it was opened at. */
export function appOrigin(opened: string, env: Record<string, string | undefined> = process.env) {
  const base = env.BETTER_AUTH_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : opened);
  return new URL(base).origin;
}

/** The address Spotify sends people back to, which has to be registered in the Spotify app exactly as it is. */
export const redirectUri = (opened: string, env?: Record<string, string | undefined>) => `${appOrigin(opened, env)}/api/spotify/callback`;
