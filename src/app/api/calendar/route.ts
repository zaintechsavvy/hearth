import { NextResponse } from "next/server";
import { getHome } from "@/lib/session";
import { agendaFor } from "@/lib/widgets/calendar";

export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest") return NextResponse.json({ error: "Guests cannot see this." }, { status: 403 });
  const ids = new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean).slice(0, 20);
  return NextResponse.json(await agendaFor(home.homeId, ids));
}
