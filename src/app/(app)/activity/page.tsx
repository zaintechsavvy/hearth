import type { Metadata } from "next";
import { ActivityView } from "@/components/activity/activity-view";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  await requireUser();
  return <ActivityView />;
}
