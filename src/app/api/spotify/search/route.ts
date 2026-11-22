import { readableError } from "@/lib/home";
import { search } from "@/lib/spotify/client";
import { getHome } from "@/lib/session";

export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest") return new Response(null, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200);
  if (!query) return Response.json({ items: [] });
  try {
    return Response.json({ items: await search(home.homeId, query) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
