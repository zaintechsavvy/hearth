import { z } from "zod";
import { readableError } from "@/lib/home";
import { play } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

const playInput = z.object({
  media: z.object({ id: z.string().regex(/^(spotify|hearth):/).max(300), type: z.string().min(1).max(300) }),
  speakers: z.array(z.string().trim().min(1).max(200)).max(4),
  shuffle: z.boolean().default(false),
});

/** Starts something from the home's Spotify on the Spotify Connect device named like the chosen speaker. */
export async function POST(request: Request) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  const parsed = playInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  try {
    await play(home.homeId, parsed.data);
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
