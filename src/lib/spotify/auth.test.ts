import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SPOTIFY_SCOPES, authorizeUrl, isClientId, pkcePair, redirectUri } from "./auth";

describe("Spotify sign in", () => {
  it("makes a PKCE verifier and its S256 challenge", () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(pkcePair().verifier).not.toBe(verifier);
  });

  it("asks Spotify for a code with the challenge, never a secret", () => {
    const url = new URL(authorizeUrl({ clientId: "a".repeat(32), redirectUri: "https://hearth.example.com/api/spotify/callback", challenge: "c", state: "s" }));
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code", client_id: "a".repeat(32), scope: SPOTIFY_SCOPES.join(" "), redirect_uri: "https://hearth.example.com/api/spotify/callback",
      code_challenge_method: "S256", code_challenge: "c", state: "s",
    });
  });

  it("sends Spotify back to BETTER_AUTH_URL, then Vercel's address, then where Hearth was opened", () => {
    expect(redirectUri("http://127.0.0.1:3000", { BETTER_AUTH_URL: "https://hearth.example.com/" })).toBe("https://hearth.example.com/api/spotify/callback");
    expect(redirectUri("http://127.0.0.1:3000", { VERCEL_PROJECT_PRODUCTION_URL: "hearth.vercel.app" })).toBe("https://hearth.vercel.app/api/spotify/callback");
    expect(redirectUri("http://127.0.0.1:3000", {})).toBe("http://127.0.0.1:3000/api/spotify/callback");
  });

  it("knows a Client ID when it sees one", () => {
    expect(isClientId("0123456789abcdef0123456789ABCDEF")).toBe(true);
    expect(isClientId("not-an-id")).toBe(false);
  });
});
