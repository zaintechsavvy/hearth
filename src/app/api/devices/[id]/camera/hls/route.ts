import { NextResponse } from "next/server";
import { deviceProvider, readableError } from "@/lib/home";
import { getUser } from "@/lib/session";

/** Starts an HLS stream and returns its playlist under this route, which relays every playlist and segment. */
export async function POST(_request: Request, { params }: RouteContext<"/api/devices/[id]/camera/hls">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const id = (await params).id;
  const target = await deviceProvider(user.id, decodeURIComponent(id));
  if (!target?.provider.cameraHls) return NextResponse.json({ error: "This camera has no HLS stream." }, { status: 409 });
  try {
    const upstream = await target.provider.cameraHls(target.nativeId);
    return NextResponse.json({ playlist: `/api/devices/${encodeURIComponent(decodeURIComponent(id))}/camera/hls/${upstream.slice("/api/hls/".length)}` });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
