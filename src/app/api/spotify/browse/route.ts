import { readableError } from "@/lib/home";
import { browse } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

/** The home's Spotify library through its own sign in: playlists, liked songs, albums, and what is inside each. */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  const search = new URL(request.url).searchParams;
  const id = search.get("id") ?? "", type = search.get("type") ?? "";
  if (!id !== !type || id.length > 300 || type.length > 300) return new Response(null, { status: 400 });
  try {
    return Response.json(await browse(home.homeId, id ? { id, type } : null), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
