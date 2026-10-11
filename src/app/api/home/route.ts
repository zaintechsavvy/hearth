import { NextResponse } from "next/server";
import { loadHome } from "@/lib/home";
import { getUser } from "@/lib/session";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return NextResponse.json(await loadHome(user.id));
}
