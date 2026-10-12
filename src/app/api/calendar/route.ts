import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import { agendaFor } from "@/lib/widgets/calendar";

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const ids = new URL(request.url).searchParams.get("ids")?.split(",").filter(Boolean).slice(0, 20);
  return NextResponse.json(await agendaFor(user.id, ids));
}
