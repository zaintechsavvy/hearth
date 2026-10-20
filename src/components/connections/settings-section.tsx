"use client";

import { useContext, type ReactNode } from "react";
import { SettingsFoldingContext } from "./settings-folding";
import styles from "./settings-section.module.css";

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: ReactNode;
  /** Shown beside the title, such as an Add button. */
  action?: ReactNode;
  children: ReactNode;
}

/** One settings section, shown while it is the open one. It stays mounted while another is open, so a half-filled form survives. */
export function SettingsSection({ id, title, description, action, children }: SettingsSectionProps) {
  const { open } = useContext(SettingsFoldingContext);
  return (
    <section id={id} className={styles.section} hidden={open !== id} aria-labelledby={`${id}-title`}>
      <div className={styles.head} data-on-wall>
        <div className={styles.text}>
          <h2 id={`${id}-title`} className={styles.title}>{title}</h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
        {action && <div className={styles.action}>{action}</div>}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
