import { AssistantDock } from "@/components/assistant/assistant-dock";
import { DoorbellCall } from "@/components/dashboard/doorbell-call";
import { HouseholdAlerts } from "@/components/dashboard/household/household-alerts";
import { Wallpaper } from "@/components/glass/wallpaper";
import { AppHeader } from "@/components/shell/app-header";
import { BedtimeCheck } from "@/components/shell/bedtime-check";
import { BackgroundStudio } from "@/components/shell/background-studio";
import { CommandMenu } from "@/components/shell/command-menu";
import { WallMode } from "@/components/shell/wall-mode";
import { requireHome } from "@/lib/session";
import styles from "./app.module.css";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const home = await requireHome();
  const { user } = home;
  return (
    <>
      <Wallpaper />
      <AppHeader user={{ name: user.name, email: user.email }} role={home.role} ownerName={home.ownerName} />
      <main className={styles.page}>{children}</main>
      {home.role !== "guest" && <AssistantDock />}
      <BackgroundStudio />
      <CommandMenu limited={home.role === "guest"} />
      <WallMode />
      <HouseholdAlerts />
      {home.role !== "guest" && <BedtimeCheck />}
      <DoorbellCall />
    </>
  );
}
