import { NextResponse } from "next/server";
import { z } from "zod";
import { unseal } from "@/lib/crypto";
import { getPreferences, readableError } from "@/lib/home";
import { getHome } from "@/lib/session";
import { departuresFrom } from "@/lib/transit";

const stops = z.array(z.object({ key: z.string().min(1).max(200), name: z.string().max(120) })).min(1).max(4);

/** The next departures from a tile's stops, given as `stops`, a JSON list of `{ key, name }`. */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { transit } = await getPreferences(home.homeId);
  if (!transit) return NextResponse.json({ error: "Add a Transitland key first." }, { status: 409 });
  const parsed = stops.safeParse(JSON.parse(new URL(request.url).searchParams.get("stops") ?? "[]"));
  if (!parsed.success) return NextResponse.json({ error: "Choose a stop first." }, { status: 400 });
  try {
    return NextResponse.json({ departures: await departuresFrom(unseal<string>(transit.key), parsed.data) });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
