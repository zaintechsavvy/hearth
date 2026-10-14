import { deviceProvider, readableError } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

/** Relays the cover of what a media player is playing. The address carries a version, so a cover can be cached. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/artwork">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  const id = decodeURIComponent((await params).id);
  if (home.role === "guest" && !(await guestCanReach(home, id))) return new Response(null, { status: 403 });
  const target = await deviceProvider(home.homeId, id);
  if (!target?.provider.artwork) return new Response(null, { status: 404 });
  try {
    const upstream = await target.provider.artwork(target.nativeId, request.signal);
    if (!upstream.ok || !upstream.body) return new Response(null, { status: 502 });
    return new Response(upstream.body, {
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
