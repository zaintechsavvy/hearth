import { deviceProvider, readableError } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

/** The items on a Home Assistant list, for the shopping list tile. */
export async function GET(_request: Request, { params }: RouteContext<"/api/devices/[id]/todo">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  const id = decodeURIComponent((await params).id);
  if (home.role === "guest" && !(await guestCanReach(home, id))) return new Response(null, { status: 403 });
  const target = await deviceProvider(home.homeId, id);
  if (!target?.provider.todoItems) return Response.json([]);
  try {
    return Response.json(await target.provider.todoItems(target.nativeId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
