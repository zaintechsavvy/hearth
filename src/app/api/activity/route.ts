import { and, desc, eq, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ACTIVITY_CATEGORIES, type ActivityCategory, type ActivityEntry } from "@/lib/activity-types";
import { db } from "@/lib/db";
import { activity } from "@/lib/db/schema";
import { getUser } from "@/lib/session";

const PAGE = 80;

/** The activity log newest first, a page at a time, optionally one category or room. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const before = params.get("before"), category = params.get("category"), room = params.get("room");
  const filters = [eq(activity.userId, user.id)];
  if (before && !Number.isNaN(Date.parse(before))) filters.push(lt(activity.at, new Date(before)));
  if (category && (ACTIVITY_CATEGORIES as readonly string[]).includes(category)) filters.push(eq(activity.category, category as ActivityCategory));
  if (room) filters.push(eq(activity.room, room));
  const rows = await db.select().from(activity).where(and(...filters)).orderBy(desc(activity.at)).limit(PAGE);
  const entries: ActivityEntry[] = rows.map(row => ({ ...row, at: row.at.toISOString() }));
  return NextResponse.json({ entries, more: rows.length === PAGE });
}
