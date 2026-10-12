import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { background } from "@/lib/db/schema";
import { getUser } from "@/lib/session";

/** Photos never change once uploaded, so the browser can keep them for a year. */
export async function GET(_request: Request, { params }: RouteContext<"/api/backgrounds/[id]">) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  const row = await db.query.background.findFirst({ where: and(eq(background.id, (await params).id), eq(background.userId, user.id)) });
  if (!row) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(row.data), { headers: { "Content-Type": row.mime, "Cache-Control": "private, max-age=31536000, immutable" } });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/backgrounds/[id]">) {
  const user = await getUser();
  if (!user) return new Response(null, { status: 401 });
  await db.delete(background).where(and(eq(background.id, (await params).id), eq(background.userId, user.id)));
  return new Response(null, { status: 204 });
}
