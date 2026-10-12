import { NextResponse } from "next/server";
import { getHome } from "@/lib/session";
import { remindersFor } from "@/lib/widgets/reminders";

export async function GET() {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest") return NextResponse.json({ error: "Guests cannot see this." }, { status: 403 });
  return NextResponse.json(await remindersFor(home.homeId));
}
