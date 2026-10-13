import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Wallpaper } from "@/components/glass/wallpaper";
import { getUser } from "@/lib/session";
import styles from "./auth.module.css";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getUser()) redirect("/dashboard");
  return (
    <div className={styles.page}>
      <Wallpaper />
      <header className={styles.header} data-on-wall><Link href="/" aria-label="Hearth"><Logo /></Link></header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
