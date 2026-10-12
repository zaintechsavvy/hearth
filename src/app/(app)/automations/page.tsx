import type { Metadata } from "next";
import { AutomationsView } from "@/components/automations/automations-view";
import { requireHome } from "@/lib/session";

export const metadata: Metadata = { title: "Automations" };

export default async function AutomationsPage() {
  await requireHome("member");
  return <AutomationsView />;
}
