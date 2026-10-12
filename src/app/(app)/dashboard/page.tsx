import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireHome } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const home = await requireHome();
  return <DashboardView userName={home.user.name} canEdit={home.role !== "guest"} />;
}
