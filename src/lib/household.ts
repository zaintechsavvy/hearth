import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { membership, preference, user } from "@/lib/db/schema";
import type { DashboardPage, SavedTile } from "@/lib/dashboard/layout";
import type { HomeSnapshot } from "@/lib/home";

export type Role = "owner" | "member" | "guest";

export interface HomeAccess {
  /** The person signed in. */
  user: { id: string; name: string; email: string };
  /** Whose home this is; every query for devices, layouts, and widgets uses it. */
  homeId: string;
  role: Role;
  /** For guests, the pages they can see. */
  pages: string[] | null;
  ownerName: string;
}

const RANK: Record<Role, number> = { guest: 0, member: 1, owner: 2 };
export const atLeast = (role: Role, needed: Role) => RANK[role] >= RANK[needed];

/** The home a signed-in person acts in: their own, or the one they joined. Cached for the request. */
export const homeFor = cache(async (person: { id: string; name: string; email: string }): Promise<HomeAccess> => {
  const row = await db.query.membership.findFirst({ where: eq(membership.memberId, person.id) });
  if (!row) return { user: person, homeId: person.id, role: "owner", pages: null, ownerName: person.name };
  const owner = await db.query.user.findFirst({ where: eq(user.id, row.ownerId), columns: { name: true } });
  return { user: person, homeId: row.ownerId, role: row.role, pages: row.pages ?? [], ownerName: owner?.name ?? "Someone" };
});

const linkOf = (tile: SavedTile) => "link" in tile ? tile.link : tile.id;

/** Everything a guest's pages link to: device ids, `camera:` and `scene:` links. */
export function guestLinks(pages: DashboardPage[], allowed: string[]) {
  const links = new Set<string>();
  for (const page of pages) if (allowed.includes(page.id)) for (const tile of page.layout) { const link = linkOf(tile); if (link) links.add(link); }
  return links;
}

/** What a guest sees: only their pages, and only the devices, cameras, scenes, and widgets those pages show. */
export function guestView(home: HomeSnapshot, allowed: string[]): HomeSnapshot {
  const pages = home.pages.filter(page => allowed.includes(page.id));
  const links = guestLinks(home.pages, allowed);
  const kinds = new Set(pages.flatMap(page => page.layout.map(tile => "kind" in tile ? tile.kind : undefined)));
  const widgetKind: Record<string, string> = { bin: "bins", medication: "medications", countdown: "countdown", note: "notes", wifi: "wifi", timer: "timers", plant: "plants" };
  const devices = home.devices.filter(device => links.has(device.id));
  return {
    ...home,
    devices,
    integrations: [],
    cameras: home.cameras.filter(camera => links.has(`camera:${camera.id}`)),
    scenes: home.scenes.filter(scene => links.has(`scene:${scene.id}`)),
    pages,
    layout: pages[0]?.layout ?? [],
    rooms: home.rooms.filter(room => devices.some(device => device.room === room)),
    widgets: home.widgets.filter(item => kinds.has(widgetKind[item.kind] as never)),
  };
}

/** Whether a guest may touch a device, camera, or scene: it has to be on one of their pages. */
export async function guestCanReach(access: HomeAccess, link: string) {
  if (access.role !== "guest") return true;
  const row = await db.query.preference.findFirst({ where: eq(preference.userId, access.homeId), columns: { pages: true, layout: true } });
  const pages: DashboardPage[] = row?.pages.length ? row.pages : [{ id: "home", name: "Home", layout: row?.layout ?? [] }];
  return guestLinks(pages, access.pages ?? []).has(link);
}
