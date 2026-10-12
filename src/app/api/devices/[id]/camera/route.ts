import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integration } from "@/lib/db/schema";
import { parseDeviceId } from "@/lib/devices/types";
import { readableError } from "@/lib/home";
import { createProvider } from "@/lib/integrations/registry";
import { getUser } from "@/lib/session";

/** Relays a camera that an integration can stream, such as any Home Assistant camera, as MJPEG or one JPEG. */
export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/camera">) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const parsed = parseDeviceId(decodeURIComponent((await params).id));
  if (!parsed) return new Response(null, { status: 404 });
  const row = await db.query.integration.findFirst({ where: and(eq(integration.id, parsed.integrationId), eq(integration.userId, user.id)) });
  const provider = row && createProvider(row);
  if (!provider?.camera) return new Response(null, { status: 404 });

  const mode = new URL(request.url).searchParams.get("mode") === "snapshot" ? "snapshot" : "stream";
  try {
    const upstream = await provider.camera(parsed.nativeId, mode, request.signal);
    if (!upstream.ok || !upstream.body) return new Response(null, { status: 502 });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? (mode === "stream" ? "multipart/x-mixed-replace" : "image/jpeg"),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: readableError(error) }, { status: 502 });
  }
}
