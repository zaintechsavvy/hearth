import { NextResponse } from "next/server";
import { readableError, runScene } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

export async function POST(_request: Request, { params }: RouteContext<"/api/scenes/[id]">) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  try {
    const id = (await params).id;
    if (home.role === "guest" && !(await guestCanReach(home, `scene:${id}`))) return NextResponse.json({ error: "Guests cannot run that." }, { status: 403 });
    const result = await runScene(home.homeId, id);
    if (!result) return NextResponse.json({ error: "That scene no longer exists." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
