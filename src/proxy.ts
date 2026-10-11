import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/sign-in", "/sign-up"];

/** A fast cookie presence check only; layouts and routes verify the session itself. */
export function proxy(request: NextRequest) {
  if (PUBLIC.includes(request.nextUrl.pathname) || getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\.[a-z]+$).*)"],
};
