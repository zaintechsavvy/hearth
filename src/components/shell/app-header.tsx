"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Activity, Compass, House, Settings, Workflow, type LucideIcon } from "lucide-react";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { UserMenu } from "@/components/arc/user-menu/user-menu";
import { Logo } from "@/components/brand/logo";
import { authClient } from "@/lib/auth-client";
import { CommandMenuButton } from "./command-menu";
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
  const links = LINKS.filter(link => role !== "guest" || link.href === "/dashboard");
  // The highlight moves on the tap, not when the next page has loaded; the tap only counts while still on this page.
  const [tapped, setTapped] = useState<{ href: string; from: string } | null>(null);
  const chosen = tapped?.from === pathname ? tapped.href : links.find(link => pathname.startsWith(link.href))?.href;
  const current = links.find(link => pathname.startsWith(link.href)) ?? links[0];

  return (
    <header className={styles.header} data-wall-hide>
      <span className={styles.brandRow} data-on-wall>
        <Link href="/dashboard" className={styles.brand} aria-label="Hearth home"><Logo /></Link>
        {role !== "owner" && <span className={styles.household} title={role === "guest" ? "You are a guest" : "You share this home"}>{ownerName.split(" ")[0]}&apos;s home{role === "guest" ? " · Guest" : ""}</span>}
      </span>
      <nav aria-label="Main" className={styles.nav}>
        {links.map(link => {
          const active = chosen === link.href;
          return (
            <Link key={link.href} href={link.href} prefetch className={styles.link} aria-current={pathname.startsWith(link.href) ? "page" : undefined}
              data-active={active || undefined} onClick={() => setTapped({ href: link.href, from: pathname })}>
              {active && <motion.span layoutId="nav-highlight" className={styles.highlight} transition={reduce ? { duration: 0 } : { duration: .18, ease: [.2, .8, .2, 1] }} aria-hidden="true" />}
              <span className={styles.label}>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      {links.length > 1 && (
        <div className={styles.pageMenu} data-on-wall>
          <DropdownMenu label={current.label} icon={<current.icon size={16} strokeWidth={1.75} />} items={[
            ...links.map(link => ({ label: link.label, icon: <link.icon size={16} strokeWidth={1.75} />, onSelect: () => router.push(link.href) })),
          ]} />
        </div>
      )}
      <div className={styles.account} data-on-wall>
        <CommandMenuButton className={styles.search} />
        <UserMenu
          user={user}
          showTheme={false}
          items={role === "guest" ? [] : [
            { label: "Settings", icon: <Settings size={16} strokeWidth={1.75} />, onSelect: () => router.push("/settings") },
            { label: "Setting up Hearth", icon: <Compass size={16} strokeWidth={1.75} />, onSelect: () => router.push("/guide") },
          ]}
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
