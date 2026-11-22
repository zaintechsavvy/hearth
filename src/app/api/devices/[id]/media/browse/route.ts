import { deviceProvider, readableError } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

/** What is inside an album, artist, or playlist a media player found, such as an album's songs; with no id, the top of its library. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/media/browse">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  const id = decodeURIComponent((await params).id);
  if (home.role === "guest" && !(await guestCanReach(home, id))) return new Response(null, { status: 403 });
  const search = new URL(request.url).searchParams;
  const mediaId = search.get("id") ?? "", mediaType = search.get("type") ?? "";
  if (!mediaId !== !mediaType || mediaId.length > 500 || mediaType.length > 60) return new Response(null, { status: 400 });
  const target = await deviceProvider(home.homeId, id);
  if (!target?.provider.browseMedia) return Response.json({ error: "This player has no music library to open." }, { status: 501 });
  try {
    return Response.json(await target.provider.browseMedia(target.nativeId, mediaId ? { id: mediaId, type: mediaType } : null), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
