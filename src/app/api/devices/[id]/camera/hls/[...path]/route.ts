import { deviceProvider } from "@/lib/home";
import { getUser } from "@/lib/session";

const SEGMENT = /^[\w.-]+$/;
const PASSED_HEADERS = ["content-type", "content-length"];

/** Relays one HLS playlist or segment. Playlists use relative addresses, so everything they name comes back through here. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/camera/hls/[...path]">) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const { id, path } = await params;
  if (path.length < 2 || !path.every(part => SEGMENT.test(part) && part !== "." && part !== "..")) return new Response(null, { status: 400 });
  const target = await deviceProvider(user.id, decodeURIComponent(id));
  if (!target?.provider.cameraHlsFetch) return new Response(null, { status: 404 });
  try {
    const upstream = await target.provider.cameraHlsFetch(`/api/hls/${path.join("/")}`, new URL(request.url).search, request.signal);
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    for (const name of PASSED_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return new Response(null, { status: 502 });
  }
}
