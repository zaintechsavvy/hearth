import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/", "/sign-in", "/sign-up"];

/** A fast cookie presence check only; layouts and routes verify the session itself. */
export function proxy(request: NextRequest) {
  if (PUBLIC.includes(request.nextUrl.pathname) || getSessionCookie(request)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const target = new URL("/sign-in", request.url);
  if (pathname !== "/dashboard") target.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\.[a-z]+$).*)"],
};
