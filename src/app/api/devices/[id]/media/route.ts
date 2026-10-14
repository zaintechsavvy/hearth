import { deviceProvider, readableError } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

/** What a media player played recently and what it plays next, for the player's queue view. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/media">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  const id = decodeURIComponent((await params).id);
  if (home.role === "guest" && !(await guestCanReach(home, id))) return new Response(null, { status: 403 });
  const target = await deviceProvider(home.homeId, id);
  if (!target?.provider.mediaQueue) return Response.json({ recent: [], next: null });
  const search = new URL(request.url).searchParams;
  try {
    return Response.json(await target.provider.mediaQueue(target.nativeId, search.get("title"), search.get("queue") === "1"), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
