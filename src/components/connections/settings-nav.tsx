"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./settings-nav.module.css";

export interface SettingsNavItem {
  id: string;
  label: string;
}

/** Jumps between settings sections, and follows along as the page scrolls. */
export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const [current, setCurrent] = useState(items[0]?.id);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting ? entry.boundingClientRect.top : Infinity);
      const top = [...visible].filter(([, y]) => y !== Infinity).sort((a, b) => a[1] - b[1])[0];
      if (top) setCurrent(top[0]);
    }, { rootMargin: "-120px 0px -55% 0px" });
    for (const item of items) {
      const section = document.getElementById(item.id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-id="${current}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  return (
    <nav className={styles.nav} aria-label="Settings sections">
      <div ref={list} className={styles.list}>
        {items.map(item => (
          <a key={item.id} href={`#${item.id}`} data-id={item.id} className={styles.link} aria-current={item.id === current ? "true" : undefined}>{item.label}</a>
        ))}
      </div>
    </nav>
  );
}
