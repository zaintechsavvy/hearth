"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { SettingsFoldingContext } from "./settings-folding";
import styles from "./settings-shell.module.css";

export interface SettingsNavItem {
  id: string;
  label: string;
}

const HASH_EVENT = "hearth:hash";

function subscribe(onChange: () => void) {
  addEventListener("hashchange", onChange);
  addEventListener(HASH_EVENT, onChange);
  return () => {
    removeEventListener("hashchange", onChange);
    removeEventListener(HASH_EVENT, onChange);
  };
}

const currentHash = () => decodeURIComponent(location.hash.slice(1));

/**
 * Settings as folded sections with a menu beside them. The open section is the URL's hash, so a link such as
 * `/settings#alerts` arrives with Alerts open and highlighted, and opening one by hand keeps the address shareable.
 */
export function SettingsShell({ items, children }: { items: SettingsNavItem[]; children: ReactNode }) {
  const hash = useSyncExternalStore(subscribe, currentHash, () => "");
  const open = items.some(item => item.id === hash) ? hash : null;

  const select = (id: string | null) => {
    history.replaceState(history.state, "", `${location.pathname}${location.search}${id ? `#${id}` : ""}`);
    dispatchEvent(new Event(HASH_EVENT));
  };

  useEffect(() => {
    if (!open) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => document.getElementById(open)?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }));
  }, [open]);

  return (
    <SettingsFoldingContext.Provider value={{ open, select }}>
      <div className={styles.shell}>
        <nav className={styles.nav} aria-label="Settings sections">
          {items.map(item => (
            <a key={item.id} href={`#${item.id}`} className={styles.link} aria-current={item.id === open ? "true" : undefined}
              onClick={event => { event.preventDefault(); select(item.id); }}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className={styles.sections}>{children}</div>
      </div>
    </SettingsFoldingContext.Provider>
  );
}
