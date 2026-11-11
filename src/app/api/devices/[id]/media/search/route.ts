import { deviceProvider, readableError } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

/** Songs, albums, artists, and playlists a media player finds for a search, for the player's search view. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/media/search">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  const id = decodeURIComponent((await params).id);
  if (home.role === "guest" && !(await guestCanReach(home, id))) return new Response(null, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200);
  if (!query) return Response.json({ items: [] });
  const target = await deviceProvider(home.homeId, id);
  if (!target?.provider.searchMedia) return Response.json({ error: "This player cannot search for music." }, { status: 501 });
  try {
    return Response.json({ items: await target.provider.searchMedia(target.nativeId, query) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
