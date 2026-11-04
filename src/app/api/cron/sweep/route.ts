import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweepHomes } from "@/lib/monitor/sweep";

export const maxDuration = 60;

const authorized = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return Boolean(secret) && given.length === secret!.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
};

/** Looks at every home once, for a scheduled job, so Activity and alerts keep up with no screen open. Needs `CRON_SECRET`. */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  return NextResponse.json(await sweepHomes());
}
