"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Settings } from "lucide-react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { Logo } from "@/components/brand/logo";
import GlassSurface from "@/components/reactbits/GlassSurface";
import { authClient } from "@/lib/auth-client";
import { CommandMenuButton } from "./command-menu";
import { useThemePreference } from "./use-theme-preference";
import styles from "./app-header.module.css";

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppHeader({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [theme, setTheme] = useThemePreference();

  return (
    <header className={styles.header}>
      <Link href="/dashboard" className={styles.brand} aria-label="Hearth home"><Logo /></Link>
      <GlassSurface width="auto" height={46} borderRadius={23} blur={12} backgroundOpacity={0.18} saturation={1.6} className={styles.navGlass}>
        <nav aria-label="Main" className={styles.nav}>
          {LINKS.map(link => {
            const active = pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={styles.link} aria-current={active ? "page" : undefined}>
                {active && <motion.span layoutId="nav-highlight" className={styles.highlight} transition={reduce ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
                <span className={styles.label}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </GlassSurface>
      <div className={styles.account}>
        <CommandMenuButton className={styles.search} />
        <UserMenu
          user={user}
          theme={theme}
          onThemeChange={setTheme}
          items={[{ label: "Settings", icon: <Settings size={16} strokeWidth={1.75} />, onSelect: () => router.push("/settings") }]}
          onSignOut={async () => {
            await authClient.signOut();
            router.replace("/sign-in");
            router.refresh();
          }}
        />
      </div>
    </header>
  );
}
