import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardView userName={user.name} />;
}
