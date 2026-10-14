"use server";

import { and, eq } from "drizzle-orm";
import { authed, OK, type ActionResult } from "@/lib/action-helpers";
import { db } from "@/lib/db";
import { integration, widgetItem } from "@/lib/db/schema";
import { HomeAssistantProvider } from "@/lib/integrations/home-assistant";
import { createProvider } from "@/lib/integrations/registry";
import type { ItemData } from "@/lib/widgets/items";
import { followable, normalTracking, trackerSaysArrived } from "@/lib/widgets/packages";

/**
 * Asks Home Assistant's 17TRACK integration about every package still on its way: numbers it does not know yet are
 * added, and the rest pick up their latest scan, moving to delivered once 17TRACK says so. Without 17TRACK nothing
 * changes and the tile stays manual.
 */
export async function syncPackages(): Promise<ActionResult> {
  return authed(async homeId => {
    const rows = await db.select().from(widgetItem).where(and(eq(widgetItem.userId, homeId), eq(widgetItem.kind, "package")));
    const open = rows.filter(row => followable(row.data as ItemData<"package">));
    if (open.length === 0) return OK;
    const connections = await db.select().from(integration).where(and(eq(integration.userId, homeId), eq(integration.kind, "home-assistant")));
    for (const connection of connections) {
      const provider = createProvider(connection);
      if (!(provider instanceof HomeAssistantProvider)) continue;
      const entry = await provider.packageTracker();
      if (!entry) continue;
      const known = new Map((await provider.trackedPackages(entry)).map(item => [normalTracking(item.tracking), item]));
      for (const row of open) {
        const data = row.data as ItemData<"package">;
        const found = known.get(normalTracking(data.tracking));
        if (!found) {
          await provider.trackPackage(entry, normalTracking(data.tracking), data.name).catch(() => {});
          continue;
        }
        const arrived = trackerSaysArrived(found.status);
        const next = { ...data, track: { status: found.status, info: found.info, location: found.location, at: found.at }, ...(arrived ? { status: "delivered" as const, deliveredAt: found.at ?? new Date().toISOString() } : {}) };
        await db.update(widgetItem).set({ data: next }).where(and(eq(widgetItem.id, row.id), eq(widgetItem.userId, homeId)));
      }
      return OK;
    }
    return OK;
  });
}
