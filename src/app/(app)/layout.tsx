import { AssistantDock } from "@/components/assistant/assistant-dock";
import { Wallpaper } from "@/components/glass/wallpaper";
import { AppHeader } from "@/components/shell/app-header";
import { BackgroundStudio } from "@/components/shell/background-studio";
import { CommandMenu } from "@/components/shell/command-menu";
import { requireUser } from "@/lib/session";
import styles from "./app.module.css";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <>
      <Wallpaper />
      <AppHeader user={{ name: user.name, email: user.email }} />
      <main className={styles.page}>{children}</main>
      <AssistantDock />
      <BackgroundStudio />
      <CommandMenu />
    </>
  );
}
