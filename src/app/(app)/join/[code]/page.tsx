import type { Metadata } from "next";
import { and, eq, gt } from "drizzle-orm";
import { JoinCard } from "@/components/connections/join-card";
import { db } from "@/lib/db";
import { invite, user } from "@/lib/db/schema";
import { requireHome } from "@/lib/session";

export const metadata: Metadata = { title: "Join a home" };

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const home = await requireHome();
  const { code } = await params;
  const row = await db.query.invite.findFirst({ where: and(eq(invite.code, code), gt(invite.expiresAt, new Date())) });
  const owner = row ? await db.query.user.findFirst({ where: eq(user.id, row.ownerId), columns: { name: true } }) : null;
  return <JoinCard code={code} ownerName={owner?.name ?? null} role={row?.role ?? null} own={row?.ownerId === home.user.id} current={home.role === "owner" ? null : home.ownerName} />;
}
