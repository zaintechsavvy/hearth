import { DoorbellCall } from "@/components/dashboard/doorbell-call";
import { HouseholdAlerts } from "@/components/dashboard/household/household-alerts";
import { Wallpaper } from "@/components/glass/wallpaper";
import { AppHeader } from "@/components/shell/app-header";
import { BedtimeCheck } from "@/components/shell/bedtime-check";
import { BackgroundStudio } from "@/components/shell/background-studio";
import { BackgroundSync } from "@/components/shell/background-sync";
import { CommandMenu } from "@/components/shell/command-menu";
import { TapHaptics } from "@/components/shell/tap-haptics";
import { WallMode } from "@/components/shell/wall-mode";
import { loadBackground } from "@/lib/background-sync";
import { requireHome } from "@/lib/session";
import styles from "./app.module.css";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const home = await requireHome();
  const { user } = home;
  const background = await loadBackground();
  return (
    <>
      <Wallpaper />
      <BackgroundSync initial={background} />
      <AppHeader user={{ name: user.name, email: user.email }} role={home.role} ownerName={home.ownerName} />
      <main className={styles.page}>{children}</main>
      <BackgroundStudio />
      <CommandMenu limited={home.role === "guest"} />
      <WallMode />
      <HouseholdAlerts />
      {home.role !== "guest" && <BedtimeCheck />}
      <DoorbellCall />
      <TapHaptics />
    </>
  );
}
