import { NextResponse } from "next/server";
import { z } from "zod";
import { cameraForRequest } from "@/lib/cameras/camera-access";
import { readableError } from "@/lib/home";

const offerSchema = z.object({ sdp: z.string().min(1).max(64_000) });

/** Relays the browser's offer to go2rtc. Media then flows straight from go2rtc to the browser. */
export async function POST(request: Request, { params }: RouteContext<"/api/cameras/[id]/webrtc">) {
  const camera = await cameraForRequest((await params).id);
  if (!camera) return NextResponse.json({ error: "Camera not found." }, { status: 404 });
  const offer = offerSchema.safeParse(await request.json().catch(() => null));
  if (!offer.success) return NextResponse.json({ error: "Missing SDP offer." }, { status: 400 });
  try {
    let sdp = await camera.relay.answer(camera.stream, offer.data.sdp);
    if (sdp === null) {
      await camera.relay.upsert(camera.stream, camera.source);
      sdp = await camera.relay.answer(camera.stream, offer.data.sdp);
    }
    if (sdp === null) return NextResponse.json({ error: "The stream relay does not know this camera." }, { status: 502 });
    return NextResponse.json({ sdp });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
