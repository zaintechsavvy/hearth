import { NextResponse } from "next/server";
import { historyFor, RANGES, type HistoryRange } from "@/lib/history";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/history">) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (home.role === "guest" && !(await guestCanReach(home, decodeURIComponent((await params).id)))) return new Response(null, { status: 403 });
  const range = new URL(request.url).searchParams.get("range") ?? "24h";
  if (!(range in RANGES)) return NextResponse.json({ error: "Use a range of 24h, 7d, or 30d." }, { status: 400 });
  const history = await historyFor(home.homeId, decodeURIComponent((await params).id), range as HistoryRange);
  return history ? NextResponse.json(history, { headers: { "Cache-Control": "private, max-age=60" } }) : NextResponse.json({ error: "Unknown device." }, { status: 404 });
}
