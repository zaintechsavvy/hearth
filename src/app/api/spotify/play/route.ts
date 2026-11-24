import { z } from "zod";
import { deviceProvider, readableError } from "@/lib/home";
import { play, type Wake } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

const playInput = z.object({
  /** Null moves what Spotify plays now to the speaker. */
  media: z.object({ id: z.string().regex(/^(spotify|hearth):/).max(300), type: z.string().min(1).max(300) }).nullable(),
  speakers: z.array(z.string().trim().min(1).max(200)).max(4),
  /** The speaker's own device, which Hearth wakes when Spotify Connect cannot see it yet. */
  device: z.string().min(1).max(300).optional(),
  shuffle: z.boolean().default(false),
});

/** Starts something from the home's Spotify on the Spotify Connect device named like the chosen speaker. */
export async function POST(request: Request) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  const parsed = playInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.media && !parsed.data.speakers.length)) return new Response(null, { status: 400 });
  try {
    const { device, ...input } = parsed.data;
    const target = device ? await deviceProvider(home.homeId, device) : null;
    const startSpotify = target?.provider.startSpotify?.bind(target.provider);
    const wake: Wake | undefined = target && startSpotify ? start => startSpotify(target.nativeId, start) : undefined;
    await play(home.homeId, { ...input, wake });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
