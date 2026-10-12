import type { Metadata } from "next";
import { AutomationsView } from "@/components/automations/automations-view";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Automations" };

export default async function AutomationsPage() {
  await requireUser();
  return <AutomationsView />;
}
