import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import { remindersFor } from "@/lib/widgets/reminders";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return NextResponse.json(await remindersFor(user.id));
}
