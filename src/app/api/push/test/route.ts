import { NextResponse } from "next/server";
import { sendPush } from "@/lib/push";
import { getHome } from "@/lib/session";

export async function POST() {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const delivered = await sendPush(home.homeId, { title: "Hearth alerts are on", body: "This is what an alert looks like.", tag: "test" });
  return NextResponse.json({ delivered });
}
