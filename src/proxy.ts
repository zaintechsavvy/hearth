import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { setupProblems } from "@/lib/setup-check";

const PUBLIC = ["/", "/sign-in", "/sign-up"];
const SETUP = "/setup";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const api = pathname.startsWith("/api/");
  if (pathname !== SETUP && setupProblems().length) {
    return api ? NextResponse.json({ error: "Hearth is not set up yet. Open /setup to see what is missing." }, { status: 503 }) : NextResponse.rewrite(new URL(SETUP, request.url));
  }
  if (api || pathname === SETUP || PUBLIC.includes(pathname) || getSessionCookie(request)) return NextResponse.next();
  const target = new URL("/sign-in", request.url);
  if (pathname !== "/dashboard") target.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(target);
}

export const config = { matcher: ["/((?!_next|favicon.ico|.*\\.[a-z]+$).*)"] };
