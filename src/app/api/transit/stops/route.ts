import { NextResponse } from "next/server";
import { unseal } from "@/lib/crypto";
import { getPreferences, readableError } from "@/lib/home";
import { getHome } from "@/lib/session";
import { findStops } from "@/lib/transit";

/** Stops for the departures tile, by name or near home. */
export async function GET(request: Request) {
  const home = await getHome();
  if (!home) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const { transit, location } = await getPreferences(home.homeId);
  if (!transit) return NextResponse.json({ error: "Add a Transitland key first." }, { status: 409 });
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  try {
    return NextResponse.json({ stops: await findStops(transit.sample ? null : unseal<string>(transit.key), query, location), near: Boolean(location) });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
