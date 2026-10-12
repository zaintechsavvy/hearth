import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { pushSubscription } from "@/lib/db/schema";
import { vapidKeys } from "@/lib/push";
import { getUser } from "@/lib/session";

const subscription = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(4).max(200) }),
  label: z.string().trim().max(80).default("This device"),
});

/** The public key a browser needs to subscribe to this server's alerts. */
export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  return NextResponse.json({ publicKey: (await vapidKeys()).publicKey });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = subscription.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That subscription is not valid." }, { status: 400 });
  const { endpoint, keys, label } = parsed.data;
  await db.insert(pushSubscription).values({ endpoint, userId: user.id, p256dh: keys.p256dh, auth: keys.auth, label })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, label } });
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const user = await getUser();
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (user && endpoint) await db.delete(pushSubscription).where(and(eq(pushSubscription.endpoint, endpoint), eq(pushSubscription.userId, user.id)));
  return new Response(null, { status: 204 });
}
