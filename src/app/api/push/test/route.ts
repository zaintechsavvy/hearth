import { NextResponse } from "next/server";
import { sendPush } from "@/lib/push";
import { getUser } from "@/lib/session";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const delivered = await sendPush(user.id, { title: "Hearth alerts are on", body: "This is what an alert looks like.", tag: "test" });
  return NextResponse.json({ delivered });
}
