import { NextResponse } from "next/server";
import { deviceCommandSchema } from "@/lib/devices/command-schema";
import { readableError, runCommand } from "@/lib/home";
import { guestCanReach } from "@/lib/household";
import { getHome } from "@/lib/session";

export async function POST(request: Request, { params }: RouteContext<"/api/devices/[id]">) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const command = deviceCommandSchema.safeParse(await request.json().catch(() => null));
  if (!command.success) return NextResponse.json({ error: "That command is not valid." }, { status: 400 });
  try {
    const id = decodeURIComponent((await params).id);
    if (home.role === "guest") {
      const opens = (command.data.type === "lock" && !command.data.locked) || (command.data.type === "cover" && command.data.action === "open") || (command.data.type === "coverPosition" && command.data.value > 0);
      if (opens || !(await guestCanReach(home, id))) return NextResponse.json({ error: "Guests cannot do that." }, { status: 403 });
    }
    await runCommand(home.homeId, id, command.data, home.user.name.split(" ")[0]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
