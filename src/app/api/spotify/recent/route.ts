import { readableError } from "@/lib/home";
import { recent } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

/** The albums, playlists, artists, and songs the home's Spotify played lately. */
export async function GET() {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  try {
    return Response.json(await recent(home.homeId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
