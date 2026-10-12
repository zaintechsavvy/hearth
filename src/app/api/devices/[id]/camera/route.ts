import { deviceProvider, readableError } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

/** Relays a camera that an integration can stream, such as any Home Assistant camera, as MJPEG or one JPEG. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/camera">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest" && !(await guestCanReach(home, decodeURIComponent((await params).id)))) return new Response(null, { status: 403 });
  const target = await deviceProvider(home.homeId, decodeURIComponent((await params).id));
  if (!target?.provider.camera) return new Response(null, { status: 404 });

  const mode = new URL(request.url).searchParams.get("mode") === "snapshot" ? "snapshot" : "stream";
  try {
    const upstream = await target.provider.camera(target.nativeId, mode, request.signal);
    if (!upstream.ok || !upstream.body) return new Response(null, { status: 502 });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? (mode === "stream" ? "multipart/x-mixed-replace" : "image/jpeg"),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
