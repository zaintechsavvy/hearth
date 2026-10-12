import { NextResponse } from "next/server";
import { readableError } from "@/lib/home";
import { getUser } from "@/lib/session";
import { searchPlaces } from "@/lib/widgets/weather";

export async function GET(request: Request) {
  if (!(await getUser())) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ places: [] });
  try {
    return NextResponse.json({ places: await searchPlaces(query.slice(0, 80)) });
  } catch (error) {
    return NextResponse.json({ error: readableError(error) }, { status: 502 });
  }
}
