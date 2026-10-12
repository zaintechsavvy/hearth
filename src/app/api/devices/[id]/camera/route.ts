import { deviceProvider, readableError } from "@/lib/home";
import { getUser } from "@/lib/session";

/** Relays a camera that an integration can stream, such as any Home Assistant camera, as MJPEG or one JPEG. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/camera">) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const target = await deviceProvider(user.id, decodeURIComponent((await params).id));
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
