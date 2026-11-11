import { deviceProvider, readableError } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

/** The rooms a robot vacuum has mapped, for choosing which ones to clean. */
export async function GET(_request: Request, { params }: RouteContext<"/api/devices/[id]/vacuum-areas">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  const id = decodeURIComponent((await params).id);
  if (home.role === "guest" && !(await guestCanReach(home, id))) return new Response(null, { status: 403 });
  const target = await deviceProvider(home.homeId, id);
  if (!target?.provider.vacuumAreas) return Response.json({ areas: [] });
  try {
    return Response.json({ areas: await target.provider.vacuumAreas(target.nativeId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
