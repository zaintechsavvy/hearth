import { NextResponse } from "next/server";
import { deviceCommandSchema } from "@/lib/devices/command-schema";
import { readableError, runCommand } from "@/lib/home";
import { getUser } from "@/lib/session";

export async function POST(request: Request, { params }: RouteContext<"/api/devices/[id]">) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const command = deviceCommandSchema.safeParse(await request.json().catch(() => null));
  if (!command.success) return NextResponse.json({ error: "That command is not valid." }, { status: 400 });
  try {
    await runCommand(user.id, decodeURIComponent((await params).id), command.data);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
