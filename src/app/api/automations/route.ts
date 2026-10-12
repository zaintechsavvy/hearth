import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sunTimes } from "@/lib/automations/sun";
import { db } from "@/lib/db";
import { automation } from "@/lib/db/schema";
import { getPreferences } from "@/lib/home";
import { toAutomation } from "@/lib/monitor/automations";
import { getHome } from "@/lib/session";

export async function GET() {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest") return NextResponse.json({ error: "Guests cannot see this." }, { status: 403 });
  const [rows, { location }] = await Promise.all([
    db.select().from(automation).where(eq(automation.userId, home.homeId)).orderBy(desc(automation.createdAt)),
    getPreferences(home.homeId),
  ]);
  const sun = location ? sunTimes(new Date(), location.latitude, location.longitude) : null;
  return NextResponse.json({
    automations: rows.map(toAutomation),
    location,
    sun: sun && { sunrise: sun.sunrise.toISOString(), sunset: sun.sunset.toISOString() },
  });
}
