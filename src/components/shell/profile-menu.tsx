"use client";

import { Compass, LogOut, Settings, Tablet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { authClient } from "@/lib/auth-client";
import { DEFAULT_WALL, WALL_KEY, type WallSettings } from "@/lib/wall";
import { useStoredJson } from "./use-stored-json";
import styles from "./profile-menu.module.css";

const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";

/**
 * The account menu behind the avatar, laid out like the wall tablet's menu: Settings, the guide, and turning this
 * screen into a wall tablet as tiles along the top, then who is signed in and a way out.
 */
export function ProfileMenu({ user, guest }: { user: { name: string; email: string }; guest: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [wall, setWall] = useStoredJson<WallSettings>(WALL_KEY, DEFAULT_WALL);
  const startWall = () => {
    setOpen(false);
    setWall({ ...DEFAULT_WALL, ...wall, enabled: true });
    void document.documentElement.requestFullscreen?.().catch(() => {});
    router.push("/dashboard");
  };
  const signOut = async () => {
    setOpen(false);
    await authClient.signOut();
    router.replace("/sign-in");
    router.refresh();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={`${glassClass("pill")} ${styles.avatar}`} aria-label={`${user.name}, account`}>{initialsOf(user.name)}</button>
      </PopoverTrigger>
      <PopoverContent align="end" className={`${glassSheetClass} ${styles.content}`}>
        <nav aria-label="Account" className={styles.tiles} data-count={guest ? 1 : 3}>
          {!guest && (
            <Link href="/settings" className={styles.tile} onClick={() => setOpen(false)}>
              <Settings size={18} strokeWidth={1.75} aria-hidden="true" />Settings
            </Link>
          )}
          {!guest && (
            <Link href="/guide" className={styles.tile} onClick={() => setOpen(false)}>
              <Compass size={18} strokeWidth={1.75} aria-hidden="true" />Guide
            </Link>
          )}
          <button type="button" className={styles.tile} onClick={startWall}>
            <Tablet size={18} strokeWidth={1.75} aria-hidden="true" />Wall tablet
          </button>
        </nav>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.who}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.email}>{user.email}</span>
        </div>
        <button type="button" className={styles.item} onClick={() => void signOut()}>
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}
