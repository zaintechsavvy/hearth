import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { unseal } from "@/lib/crypto";
import { readableError } from "@/lib/home";
import { SIGN_IN_COOKIE, appOrigin } from "@/lib/spotify/auth";
import { completeSignIn } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

interface Pending { state: string; verifier: string; homeId: string; clientId: string; redirect: string }

/** Where Spotify sends the person back: trades the code for tokens, then returns to Settings saying how it went. */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.redirect(new URL("/sign-in", request.url));
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const raw = jar.get(SIGN_IN_COOKIE)?.value;
  let pending: Pending | null = null;
  try {
    pending = raw ? unseal<Pending>(raw) : null;
  } catch {}
  const back = (outcome: string, reason?: string) => {
    const response = NextResponse.redirect(new URL(`/settings?${new URLSearchParams({ spotify: outcome, ...(reason ? { reason } : {}) })}#spotify`, appOrigin(request.url)));
    response.cookies.delete({ name: SIGN_IN_COOKIE, path: "/api/spotify" });
    return response;
  };
  if (params.get("error")) return back(params.get("error") === "access_denied" ? "denied" : "failed", params.get("error") ?? undefined);
  const code = params.get("code");
  if (!pending || !code || pending.state !== params.get("state") || pending.homeId !== home.homeId || home.role !== "owner") return back("expired");
  try {
    await completeSignIn(home.homeId, pending.clientId, code, pending.verifier, pending.redirect);
    return back("connected");
  } catch (error) {
    return back("failed", readableError(error));
  }
}
