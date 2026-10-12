import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { resolveLayout } from "@/lib/dashboard/layout";
import { tileSources } from "@/lib/dashboard/sources";
import { db } from "@/lib/db";
import { integration } from "@/lib/db/schema";
import { shownByDefault } from "@/lib/devices/types";
import { loadHome, readableError } from "@/lib/home";
import { createProvider } from "@/lib/integrations/registry";
import { getUser } from "@/lib/session";

/** Everything one connection offers, what is on the dashboard now, and what Hearth would suggest showing. */
export async function GET(_request: Request, { params }: RouteContext<"/api/integrations/[id]/review">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const id = (await params).id;
  const row = await db.query.integration.findFirst({ where: and(eq(integration.id, id), eq(integration.userId, user.id)) });
  if (!row) return NextResponse.json({ error: "That connection no longer exists." }, { status: 404 });
  try {
    const provider = createProvider(row);
    const listing = await (provider.review ?? provider.listDevices).call(provider);
    const home = await loadHome(user.id);
    const tiles = new Map(resolveLayout(home.layout, tileSources(home)).map(tile => [tile.id, tile]));
    const shown = row.curatedAt
      ? listing.devices.filter(device => tiles.has(device.id) && !tiles.get(device.id)?.hidden).map(device => device.id)
      : listing.devices.filter(shownByDefault).map(device => device.id);
    return NextResponse.json({
      name: row.name,
      devices: listing.devices,
      unsupported: listing.unsupported,
      shown,
      recommended: listing.devices.filter(shownByDefault).map(device => device.id),
      fresh: row.curatedAt ? listing.devices.filter(device => !home.layout.some(tile => tile.id === device.id)).map(device => device.id) : [],
    });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
