"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Activity, House, Settings, Workflow, type LucideIcon } from "lucide-react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { Logo } from "@/components/brand/logo";
import GlassSurface from "@/components/reactbits/GlassSurface";
import { authClient } from "@/lib/auth-client";
import { CommandMenuButton } from "./command-menu";
import { useThemePreference } from "./use-theme-preference";
import styles from "./app-header.module.css";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface AppHeaderProps {
  user: { name: string; email: string };
  role: "owner" | "member" | "guest";
  ownerName: string;
}

export function AppHeader({ user, role, ownerName }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [theme, setTheme] = useThemePreference();
  const links = LINKS.filter(link => role !== "guest" || link.href === "/dashboard");

  return (
    <header className={styles.header} data-wall-hide>
      <span className={styles.brandRow} data-on-wall>
        <Link href="/dashboard" className={styles.brand} aria-label="Hearth home"><Logo /></Link>
        {role !== "owner" && <span className={styles.household} title={role === "guest" ? "You are a guest" : "You share this home"}>{ownerName.split(" ")[0]}&apos;s home{role === "guest" ? " · Guest" : ""}</span>}
      </span>
      <GlassSurface width="auto" height={46} borderRadius={23} blur={12} backgroundOpacity={0.18} saturation={1.6} className={styles.navGlass}>
        <nav aria-label="Main" className={styles.nav}>
          {links.map(link => {
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
      <div className={styles.account} data-on-wall>
        <CommandMenuButton className={styles.search} />
        <UserMenu
          user={user}
          theme={theme}
          onThemeChange={setTheme}
          items={role === "guest" ? [] : [{ label: "Settings", icon: <Settings size={16} strokeWidth={1.75} />, onSelect: () => router.push("/settings") }]}
          onSignOut={async () => {
            await authClient.signOut();
            router.replace("/sign-in");
            router.refresh();
          }}
        />
      </div>
      {links.length > 1 && (
        <nav aria-label="Main" className={styles.tabBar}>
          {links.map(link => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={styles.tab} aria-current={active ? "page" : undefined}>
                {active && <motion.span layoutId="tab-highlight" className={styles.tabHighlight} transition={reduce ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
                <Icon size={21} strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
                <span className={styles.tabLabel}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
