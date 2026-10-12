import { guestView } from "@/lib/household";
import { NextResponse } from "next/server";
import { loadHome } from "@/lib/home";
import { getHome } from "@/lib/session";

export async function GET() {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return NextResponse.json(home.role === "guest" ? guestView(await loadHome(home.homeId), home.pages ?? []) : await loadHome(home.homeId));
}
