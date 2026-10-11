import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { db } from "@/lib/db";
import { camera } from "@/lib/db/schema";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUser();
  const cameras = await db.select({ id: camera.id, name: camera.name }).from(camera).where(eq(camera.userId, user.id)).orderBy(camera.createdAt);
  return <DashboardView userName={user.name} cameras={cameras} />;
}
