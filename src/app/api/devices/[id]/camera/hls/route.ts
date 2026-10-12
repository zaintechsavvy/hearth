import { NextResponse } from "next/server";
import { deviceProvider, readableError } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

/** Starts an HLS stream and returns its playlist under this route, which relays every playlist and segment. */
export async function POST(_request: Request, { params }: RouteContext<"/api/devices/[id]/camera/hls">) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest" && !(await guestCanReach(home, decodeURIComponent((await params).id)))) return new Response(null, { status: 403 });
  const id = (await params).id;
  const target = await deviceProvider(home.homeId, decodeURIComponent(id));
  if (!target?.provider.cameraHls) return NextResponse.json({ error: "This camera has no HLS stream." }, { status: 409 });
  try {
    const upstream = await target.provider.cameraHls(target.nativeId);
    return NextResponse.json({ playlist: `/api/devices/${encodeURIComponent(decodeURIComponent(id))}/camera/hls/${upstream.slice("/api/hls/".length)}` });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
