import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { seal } from "@/lib/crypto";
import { SIGN_IN_COOKIE, authorizeUrl, pkcePair, redirectUri } from "@/lib/spotify/auth";
import { clientIdOf, spotifyLinkOf } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

/** Starts signing in to Spotify with PKCE: the verifier waits in a sealed cookie for Spotify to send the person back. */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (home.role !== "owner") return new Response(null, { status: 403 });
  const clientId = clientIdOf(await spotifyLinkOf(home.homeId));
  if (!clientId) return NextResponse.redirect(new URL("/settings?spotify=client#spotify", request.url));
  const { verifier, challenge } = pkcePair();
  const state = randomBytes(16).toString("base64url");
  const redirect = redirectUri(new URL(request.url).origin);
  const response = NextResponse.redirect(authorizeUrl({ clientId, redirectUri: redirect, challenge, state }));
  response.cookies.set(SIGN_IN_COOKIE, seal({ state, verifier, homeId: home.homeId, clientId, redirect }), {
    httpOnly: true, sameSite: "lax", secure: redirect.startsWith("https:"), path: "/api/spotify", maxAge: 600,
  });
  return response;
}
