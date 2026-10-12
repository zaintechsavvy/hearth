import { NextResponse } from "next/server";
import { readableError } from "@/lib/home";
import { getUser } from "@/lib/session";
import { forecastFor } from "@/lib/widgets/weather";

export async function GET(request: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat")), longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: "Pick a place for this weather tile." }, { status: 400 });
  }
  try {
    return NextResponse.json(await forecastFor(latitude, longitude));
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
