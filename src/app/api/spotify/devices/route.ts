import { readableError } from "@/lib/home";
import { spotifyDeviceNames } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

/** The Spotify Connect devices Spotify lists now, by name, for watching a speaker join. */
export async function GET() {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  try {
    return Response.json({ names: await spotifyDeviceNames(home.homeId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
