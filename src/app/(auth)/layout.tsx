import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getUser } from "@/lib/session";
import styles from "./auth.module.css";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getUser()) redirect("/");
  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={styles.warm} />
        <span className={styles.cool} />
      </div>
      <header className={styles.header}><Logo /></header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
