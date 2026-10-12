import { NextResponse } from "next/server";
import { z } from "zod";
import { closeSession, openSession, touchSession } from "@/lib/cameras/webrtc-sessions";
import { deviceProvider, readableError } from "@/lib/home";
import { WebRtcUnsupportedError } from "@/lib/integrations/types";
import { getUser } from "@/lib/session";

const offerInput = z.object({ offer: z.string().min(10).max(20_000) });

/** Whether this camera offers WebRTC and which ICE servers to use, fetched before the browser builds its offer. */
export async function GET(_request: Request, { params }: RouteContext<"/api/devices/[id]/camera/webrtc">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const target = await deviceProvider(user.id, decodeURIComponent((await params).id));
  if (!target?.provider.cameraWebRtc) return NextResponse.json({ supported: false, iceServers: [] });
  try {
    return NextResponse.json(await target.provider.cameraWebRtcConfig?.(target.nativeId) ?? { supported: true, iceServers: [] });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}

/** Starts a WebRTC session for a camera: the browser sends its offer, and gets the answer and candidates back. */
export async function POST(request: Request, { params }: RouteContext<"/api/devices/[id]/camera/webrtc">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = offerInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send a WebRTC offer." }, { status: 400 });
  const target = await deviceProvider(user.id, decodeURIComponent((await params).id));
  if (!target?.provider.cameraWebRtc) return NextResponse.json({ error: "This camera has no WebRTC." }, { status: 409 });
  try {
    const { answer, candidates, close } = await target.provider.cameraWebRtc(target.nativeId, parsed.data.offer);
    if (request.signal.aborted) {
      close();
      return new Response(null, { status: 499 });
    }
    return NextResponse.json({ session: openSession(user.id, close), answer, candidates });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: error instanceof WebRtcUnsupportedError ? 409 : 502 });
  }
}

/** Keeps a session alive while its player is on screen. */
export async function PATCH(request: Request) {
  const user = await getUser();
  const session = new URL(request.url).searchParams.get("session");
  if (!user || !session) return new Response(null, { status: 401 });
  return new Response(null, { status: touchSession(user.id, session) ? 204 : 404 });
}

export async function DELETE(request: Request) {
  const user = await getUser();
  const session = new URL(request.url).searchParams.get("session");
  if (user && session) closeSession(user.id, session);
  return new Response(null, { status: 204 });
}
