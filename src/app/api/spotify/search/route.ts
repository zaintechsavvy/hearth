import { readableError } from "@/lib/home";
import { search } from "@/lib/spotify/client";
import { isSearchType } from "@/lib/spotify/items";
import { getHome } from "@/lib/session";

/** Spotify's search: every kind of result, or with `type`, one kind a page at a time from `offset`. */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().slice(0, 200);
  const type = params.get("type"), offset = Number(params.get("offset") ?? 0);
  if ((type !== null && !isSearchType(type)) || !Number.isInteger(offset) || offset < 0 || offset > 990) return new Response(null, { status: 400 });
  if (!query) return Response.json({ top: null, sections: {}, next: {} });
  try {
    return Response.json(await search(home.homeId, query, type, offset), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
