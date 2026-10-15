import { NextResponse } from "next/server";
import { z } from "zod";
import { deviceProvider, readableError } from "@/lib/home";
import { WebRtcUnsupportedError, type WebRtcAnswer } from "@/lib/integrations/types";
import { isServerless } from "@/lib/setup-check";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

const offerInput = z.object({ offer: z.string().min(10).max(20_000) });

/** Whether this camera offers WebRTC and which ICE servers to use, fetched before the browser builds its offer. */
export async function GET(_request: Request, { params }: RouteContext<"/api/devices/[id]/camera/webrtc">) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest" && !(await guestCanReach(home, decodeURIComponent((await params).id)))) return new Response(null, { status: 403 });
  const target = await deviceProvider(home.homeId, decodeURIComponent((await params).id));
  if (!target?.provider.cameraWebRtc) return NextResponse.json({ supported: false, iceServers: [] });
  try {
    return NextResponse.json(await target.provider.cameraWebRtcConfig?.(target.nativeId) ?? { supported: true, iceServers: [] });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}

/** Long enough to watch for a while; on serverless hosts the player renews the call before the platform ends it. */
export const maxDuration = 300;
const RENEW_MS = 270_000;
const HEARTBEAT_MS = 15_000;

/**
 * Starts a WebRTC call for a camera and keeps it open for as long as this response is: the browser sends a complete
 * offer and reads newline-delimited JSON back, the answer first, then late candidates, heartbeats, and an `end` line.
 * Holding the upstream session inside one request means it never depends on later requests reaching the same server,
 * which serverless hosts cannot promise. Closing the response hangs up.
 */
export async function POST(request: Request, { params }: RouteContext<"/api/devices/[id]/camera/webrtc">) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest" && !(await guestCanReach(home, decodeURIComponent((await params).id)))) return new Response(null, { status: 403 });
  const parsed = offerInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Send a WebRTC offer." }, { status: 400 });
  const target = await deviceProvider(home.homeId, decodeURIComponent((await params).id));
  if (!target?.provider.cameraWebRtc) return NextResponse.json({ error: "This camera has no WebRTC." }, { status: 409 });
  let call: WebRtcAnswer;
  try {
    call = await target.provider.cameraWebRtc(target.nativeId, parsed.data.offer);
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: error instanceof WebRtcUnsupportedError ? 409 : 502 });
  }
  if (request.signal.aborted) {
    call.close();
    return new Response(null, { status: 499 });
  }

  const encoder = new TextEncoder();
  let finish: (reason: string) => void = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let done = false;
      const send = (line: Record<string, unknown>) => { if (!done) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`)); };
      const heartbeat = setInterval(() => send({ type: "ping" }), HEARTBEAT_MS);
      const renew = isServerless() ? setTimeout(() => finish("renew"), RENEW_MS) : undefined;
      finish = reason => {
        if (done) return;
        send({ type: "end", reason });
        done = true;
        clearInterval(heartbeat);
        clearTimeout(renew);
        call.close();
        controller.close();
      };
      send({ type: "answer", answer: call.answer, candidates: call.candidates });
      call.onCandidate(candidate => send({ type: "candidate", candidate }));
      void call.ended.then(() => finish("ended"));
      request.signal.addEventListener("abort", () => finish("closed"), { once: true });
    },
    cancel() {
      finish("closed");
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
