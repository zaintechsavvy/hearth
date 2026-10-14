import { NextResponse } from "next/server";
import { activityPage } from "@/lib/activity-feed";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/lib/activity-types";
import { getHome } from "@/lib/session";

/** Everything that happened at home newest first, a page at a time, optionally one category or room. */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest") return NextResponse.json({ error: "Guests cannot see this." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const before = params.get("before"), category = params.get("category"), room = params.get("room");
  return NextResponse.json(await activityPage(home.homeId, {
    before: before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null,
    category: category && (ACTIVITY_CATEGORIES as readonly string[]).includes(category) ? category as ActivityCategory : null,
    room: room || null,
  }));
}
