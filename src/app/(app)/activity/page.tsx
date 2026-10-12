import type { Metadata } from "next";
import { ActivityView } from "@/components/activity/activity-view";
import { requireHome } from "@/lib/session";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  await requireHome("member");
  return <ActivityView />;
}
