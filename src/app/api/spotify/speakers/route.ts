import { readableError } from "@/lib/home";
import { getHome } from "@/lib/session";
import { speakerWake } from "@/lib/spotify/wake";

/** Which speakers Spotify Connect lists now, and how Hearth can start Spotify on the idle Google Cast ones. */
export async function GET() {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  try {
    return Response.json(await speakerWake(home.homeId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
