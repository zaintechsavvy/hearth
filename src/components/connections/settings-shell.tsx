"use client";

import {
  Bell, CalendarDays, Camera, ChevronLeft, ChevronRight, LayoutGrid, Moon, Palette, Plug, ShieldCheck, Sparkles, Tablet, UserRound, Users, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { SettingsFoldingContext } from "./settings-folding";
import styles from "./settings-shell.module.css";

export const SETTINGS_ICONS = {
  connections: Plug, household: Users, rooms: LayoutGrid, alerts: Bell, security: ShieldCheck, bedtime: Moon,
  assistants: Sparkles, cameras: Camera, calendars: CalendarDays, appearance: Palette, wall: Tablet, account: UserRound,
} satisfies Record<string, LucideIcon>;

export interface SettingsNavItem {
  id: keyof typeof SETTINGS_ICONS;
  label: string;
  /** One line on what is set now, shown under the name in the list on a phone. */
  summary: string;
}

export interface SettingsGroup {
  title: string;
  items: SettingsNavItem[];
}

const HASH_EVENT = "hearth:hash";
const WIDE = "(min-width: 901px)";

function subscribe(onChange: () => void) {
  addEventListener("hashchange", onChange);
  addEventListener(HASH_EVENT, onChange);
  const wide = matchMedia(WIDE);
  wide.addEventListener("change", onChange);
  return () => {
    removeEventListener("hashchange", onChange);
    removeEventListener(HASH_EVENT, onChange);
    wide.removeEventListener("change", onChange);
  };
}

const currentHash = () => decodeURIComponent(location.hash.slice(1));
const isWide = () => matchMedia(WIDE).matches;

/**
 * Settings as a short list in a few groups, and one section open at a time. On a wide screen the list sits beside
 * the open section, the first one when none is chosen; on a phone the list comes first and a section replaces it,
 * with a way back. The open section is the URL's hash, so `/settings#alerts` arrives on Alerts. `heading` names the
 * page beside the first group's title, as "Your home · Settings", and is the page's heading.
 */
export function SettingsShell({ groups, heading, children }: { groups: SettingsGroup[]; heading?: string; children: ReactNode }) {
  const hash = useSyncExternalStore(subscribe, currentHash, () => "");
  const wide = useSyncExternalStore(subscribe, isWide, () => true);
  const items = groups.flatMap(group => group.items);
  const chosen = items.some(item => item.id === hash) ? hash : null;
  const open = chosen ?? (wide ? items[0]?.id ?? null : null);

  const select = (id: string | null) => {
    history.replaceState(history.state, "", `${location.pathname}${location.search}${id ? `#${id}` : ""}`);
    dispatchEvent(new Event(HASH_EVENT));
  };

  useEffect(() => {
    if (chosen && !wide) scrollTo({ top: 0 });
  }, [chosen, wide]);

  return (
    <SettingsFoldingContext.Provider value={{ open, select }}>
      <div className={styles.shell} data-open={chosen ? "" : undefined}>
        <nav className={styles.list} aria-label="Settings sections">
          <div className={styles.pane}>
            {groups.map((group, index) => (
              <section key={group.title} className={styles.group} aria-label={group.title}>
                {heading && index === 0
                  ? <h1 className={styles.groupTitle}>{group.title}<span className={styles.headingDot} aria-hidden="true">·</span>{heading}</h1>
                  : <h2 className={styles.groupTitle}>{group.title}</h2>}
                <div className={styles.items}>
                  {group.items.map(item => {
                    const Icon = SETTINGS_ICONS[item.id];
                    return (
                      <a key={item.id} href={`#${item.id}`} className={styles.item} data-id={item.id} aria-current={item.id === open ? "true" : undefined}
                        onClick={event => { event.preventDefault(); select(item.id); }}>
                        <span className={styles.icon} aria-hidden="true"><Icon size={16} strokeWidth={1.9} /></span>
                        <span className={styles.itemText}>
                          <span className={styles.itemLabel}>{item.label}</span>
                          <span className={styles.summary}>{item.summary}</span>
                        </span>
                        <ChevronRight className={styles.chevron} size={16} strokeWidth={1.75} aria-hidden="true" />
                      </a>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <Link href="/guide" className={styles.about} data-on-wall>Setting up Hearth</Link>
          <Link href="/how-it-works" className={styles.about} data-on-wall>How Hearth works</Link>
        </nav>
        <div className={styles.main}>
          <button type="button" className={styles.back} onClick={() => select(null)} data-on-wall>
            <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" /> Settings
          </button>
          <div className={styles.sections} data-backed>{children}</div>
        </div>
      </div>
    </SettingsFoldingContext.Provider>
  );
}
