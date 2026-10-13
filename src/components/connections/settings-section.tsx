"use client";

import { ChevronDown } from "lucide-react";
import { useContext, type ReactNode } from "react";
import { SettingsFoldingContext } from "./settings-folding";
import styles from "./settings-section.module.css";

interface SettingsSectionProps {
  id: string;
  title: string;
  description?: ReactNode;
  /** Shown beside the title while the section is open, such as an Add button. */
  action?: ReactNode;
  children: ReactNode;
}

/** One folded settings section. Its contents stay mounted while folded, so a half-filled form survives. */
export function SettingsSection({ id, title, description, action, children }: SettingsSectionProps) {
  const { open, select } = useContext(SettingsFoldingContext);
  const expanded = open === id;
  return (
    <section id={id} className={styles.section} data-open={expanded || undefined} aria-labelledby={`${id}-title`}>
      <div className={styles.head} data-on-wall>
        <h2 id={`${id}-title`} className={styles.heading}>
          <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls={`${id}-panel`} onClick={() => select(expanded ? null : id)}>
            <span className={styles.text}>
              <span className={styles.title}>{title}</span>
              {description && <span className={styles.description}>{description}</span>}
            </span>
            <ChevronDown className={styles.chevron} size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </h2>
        {expanded && action && <div className={styles.action}>{action}</div>}
      </div>
      <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-title`} className={styles.body} hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}
