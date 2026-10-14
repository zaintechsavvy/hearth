import { NextResponse } from "next/server";
import { deviceCommandSchema } from "@/lib/devices/command-schema";
import { deviceProvider, getPreferences, readableError, runCommand } from "@/lib/home";
import { isSensitive, type DeviceCommand } from "@/lib/devices/types";
import { checkPin } from "@/lib/security";
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
      const opens = (command.data.type === "lock" && !command.data.locked) || (command.data.type === "cover" && command.data.action === "open") || (command.data.type === "coverPosition" && command.data.value > 0) || (command.data.type === "alarm" && command.data.action === "disarm");
      if (opens || !(await guestCanReach(home, id))) return NextResponse.json({ error: "Guests cannot do that." }, { status: 403 });
    }
    const refused = await pinRefusal(home.homeId, id, command.data, request.headers.get("x-hearth-pin"));
    if (refused) return NextResponse.json({ error: refused }, { status: 403 });
    await runCommand(home.homeId, id, command.data, home.user.name.split(" ")[0]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}

/**
 * With the PIN method, anything that opens the home needs the household PIN, checked here so no client can skip
 * it. An alarm with its own code is the exception: the alarm checks that code itself.
 */
async function pinRefusal(homeId: string, id: string, command: DeviceCommand, pin: string | null) {
  if (!["lock", "cover", "coverPosition", "alarm"].includes(command.type)) return null;
  const { security } = await getPreferences(homeId);
  if (security.method !== "pin") return null;
  const target = await deviceProvider(homeId, id);
  const device = target && (await target.provider.listDevices()).devices.find(item => item.id === id);
  if (!device || !isSensitive(device, command)) return null;
  if (device.kind === "alarm" && device.codeFormat && command.type === "alarm" && command.code) return null;
  const result = checkPin(homeId, security, pin);
  return result === "ok" ? null : result === "locked" ? "Too many wrong PINs. Try again in five minutes." : result === "missing" ? "Enter the PIN." : "That PIN is not right.";
}
