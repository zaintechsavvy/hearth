import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { seal, unseal } from "@/lib/crypto";
import { db } from "@/lib/db";
import { membership, pushSubscription, serverSecret } from "@/lib/db/schema";

const KEY = "vapid";
const SUBJECT = process.env.PUSH_CONTACT ?? "mailto:hearth@localhost";

export interface PushMessage {
  title: string;
  body: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
  url?: string;
}

const registry = globalThis as unknown as { hearthVapid?: Promise<{ publicKey: string; privateKey: string }> };

/** This server's Web Push keys, made on first use and kept sealed, so subscriptions survive restarts. */
export function vapidKeys() {
  return registry.hearthVapid ??= (async () => {
    const row = await db.query.serverSecret.findFirst({ where: eq(serverSecret.key, KEY) });
    if (row) return unseal<{ publicKey: string; privateKey: string }>(row.value);
    const keys = webpush.generateVAPIDKeys();
    await db.insert(serverSecret).values({ key: KEY, value: seal(keys) }).onConflictDoNothing();
    const saved = await db.query.serverSecret.findFirst({ where: eq(serverSecret.key, KEY) });
    return saved ? unseal<{ publicKey: string; privateKey: string }>(saved.value) : keys;
  })();
}

/** Sends to every device anyone living in the home turned alerts on for, and forgets the ones the push service says are gone. Guests get none. */
export async function sendPush(homeId: string, message: PushMessage) {
  const members = await db.select({ id: membership.memberId }).from(membership).where(and(eq(membership.ownerId, homeId), eq(membership.role, "member")));
  const subscriptions = await db.select().from(pushSubscription).where(inArray(pushSubscription.userId, [homeId, ...members.map(member => member.id)]));
  if (subscriptions.length === 0) return 0;
  const { publicKey, privateKey } = await vapidKeys();
  let delivered = 0;
  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(message),
        { vapidDetails: { subject: SUBJECT, publicKey, privateKey }, TTL: 600, urgency: "high", topic: message.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined },
      );
      delivered += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, subscription.endpoint));
      else console.error("Could not send an alert", error);
    }
  }));
  return delivered;
}
