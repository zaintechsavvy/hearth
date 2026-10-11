import { NextResponse } from "next/server";
import { cameraForRequest } from "@/lib/cameras/camera-access";
import { readableError } from "@/lib/home";

export async function GET(_request: Request, { params }: RouteContext<"/api/cameras/[id]/snapshot">) {
  const camera = await cameraForRequest((await params).id);
  if (!camera) return new NextResponse(null, { status: 404 });
  try {
    let frame = await camera.relay.snapshot(camera.stream);
    if (frame.status === 404) {
      await camera.relay.upsert(camera.stream, camera.source);
      frame = await camera.relay.snapshot(camera.stream);
    }
    if (!frame.ok || !frame.body) return new NextResponse(null, { status: 502 });
    return new NextResponse(frame.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
