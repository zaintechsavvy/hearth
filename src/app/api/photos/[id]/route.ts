import { unseal } from "@/lib/crypto";
import { getPreferences } from "@/lib/home";
import { albumPhoto } from "@/lib/photos";
import { getHome } from "@/lib/session";

/** One photo from the household's Immich album, relayed so the key stays on the server. */
export async function GET(request: Request, { params }: RouteContext<"/api/photos/[id]">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  const { photos } = await getPreferences(home.homeId);
  const id = (await params).id;
  if (!photos || !/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });
  try {
    const upstream = await albumPhoto({ ...photos, key: unseal<string>(photos.key) }, id, request.signal);
    return new Response(upstream.body, { headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
