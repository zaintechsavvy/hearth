import { deviceProvider } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

const SEGMENT = /^[\w.-]+$/;
/** Not the length or encoding: fetch hands over the body already decompressed, so Home Assistant's gzip length would cut it short. */
const PASSED_HEADERS = ["content-type"];

/** Relays one HLS playlist or segment. Playlists use relative addresses, so everything they name comes back through here. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/camera/hls/[...path]">) {
  const home = await getHome();
  if (!home) return new Response(null, { status: 401 });
  if (home.role === "guest" && !(await guestCanReach(home, decodeURIComponent((await params).id)))) return new Response(null, { status: 403 });
  const { id, path } = await params;
  if (path.length < 2 || !path.every(part => SEGMENT.test(part) && part !== "." && part !== "..")) return new Response(null, { status: 400 });
  const target = await deviceProvider(home.homeId, decodeURIComponent(id));
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
