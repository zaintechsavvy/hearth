import { NextResponse } from "next/server";
import { readableError, runScene } from "@/lib/home";
import { getUser } from "@/lib/session";

export async function POST(_request: Request, { params }: RouteContext<"/api/scenes/[id]">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const result = await runScene(user.id, (await params).id);
    if (!result) return NextResponse.json({ error: "That scene no longer exists." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
