"use server";

import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authed, OK, type ActionResult } from "@/lib/action-helpers";
import { db } from "@/lib/db";
import { invite, membership } from "@/lib/db/schema";
import { IntegrationError } from "@/lib/integrations/types";
import { publish, userTopic } from "@/lib/live/bus";
import { getUser } from "@/lib/session";

const INVITE_DAYS = 7;
const inviteInput = z.object({ role: z.enum(["member", "guest"]), pages: z.array(z.string().max(100)).max(12).optional() });

const code = () => randomBytes(9).toString("base64url");

/** A one-time link that brings someone into this home, valid for a week. Guests see only the pages chosen here. */
export async function createInvite(input: unknown): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const parsed = inviteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That invite is not valid." };
  if (parsed.data.role === "guest" && !parsed.data.pages?.length) return { ok: false, error: "Choose at least one page for the guest." };
  const value = code();
  const result = await authed(async homeId => {
    await db.insert(invite).values({ code: value, ownerId: homeId, role: parsed.data.role, pages: parsed.data.role === "guest" ? parsed.data.pages : null, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) });
    revalidatePath("/settings");
    return OK;
  }, "owner");
  return result.ok ? { ok: true, code: value } : result;
}

export async function revokeInvite(value: string): Promise<ActionResult> {
  return authed(async homeId => {
    await db.delete(invite).where(and(eq(invite.code, value), eq(invite.ownerId, homeId)));
    revalidatePath("/settings");
    return OK;
  }, "owner");
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  return authed(async homeId => {
    await db.delete(membership).where(and(eq(membership.memberId, memberId), eq(membership.ownerId, homeId)));
    publish(userTopic(memberId));
    revalidatePath("/settings");
    return OK;
  }, "owner");
}

export async function setGuestPages(memberId: string, pages: unknown): Promise<ActionResult> {
  const parsed = z.array(z.string().max(100)).min(1, "Choose at least one page.").max(12).safeParse(pages);
  if (!parsed.success) return { ok: false, error: "Choose at least one page." };
  return authed(async homeId => {
    await db.update(membership).set({ pages: parsed.data }).where(and(eq(membership.memberId, memberId), eq(membership.ownerId, homeId), eq(membership.role, "guest")));
    return OK;
  }, "owner");
}

/** Joins the home an invite belongs to. The invite is used up; the person's own home waits for them if they leave. */
export async function acceptInvite(value: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  try {
    const row = await db.query.invite.findFirst({ where: and(eq(invite.code, value), gt(invite.expiresAt, new Date())) });
    if (!row) throw new IntegrationError("This invite has expired or was already used. Ask for a new one.");
    if (row.ownerId === user.id) throw new IntegrationError("This is your own home.");
    const members = await db.select({ id: membership.memberId }).from(membership).where(eq(membership.ownerId, user.id)).limit(1);
    if (members.length) throw new IntegrationError("People share your home, so you cannot join another one.");
    await db.insert(membership).values({ memberId: user.id, ownerId: row.ownerId, role: row.role, pages: row.pages })
      .onConflictDoUpdate({ target: membership.memberId, set: { ownerId: row.ownerId, role: row.role, pages: row.pages } });
    await db.delete(invite).where(eq(invite.code, value));
    publish(userTopic(row.ownerId));
    revalidatePath("/", "layout");
    return OK;
  } catch (error) {
    return { ok: false, error: error instanceof IntegrationError ? error.message : "Could not join that home." };
  }
}

export async function leaveHome(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  await db.delete(membership).where(eq(membership.memberId, user.id));
  revalidatePath("/", "layout");
  return OK;
}
