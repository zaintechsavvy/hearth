import { NextResponse } from "next/server";
import { historyFor, RANGES, type HistoryRange } from "@/lib/history";
import { getUser } from "@/lib/session";

export async function GET(request: Request, { params }: RouteContext<"/api/devices/[id]/history">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const range = new URL(request.url).searchParams.get("range") ?? "24h";
  if (!(range in RANGES)) return NextResponse.json({ error: "Use a range of 24h, 7d, or 30d." }, { status: 400 });
  const history = await historyFor(user.id, decodeURIComponent((await params).id), range as HistoryRange);
  return history ? NextResponse.json(history, { headers: { "Cache-Control": "private, max-age=60" } }) : NextResponse.json({ error: "Unknown device." }, { status: 404 });
}
