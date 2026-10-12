"use client";

import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/arc/button/button";
import { InlineEdit } from "@/components/arc/inline-edit/inline-edit";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { Input } from "@/components/arc/input/input";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { addPage, deletePage, movePage, renamePage } from "@/lib/actions";
import type { DashboardPage } from "@/lib/dashboard/layout";
import styles from "./page-tabs.module.css";

interface PageTabsProps {
  pages: DashboardPage[];
  current: string;
  editing: boolean;
  onSelect: (id: string) => void;
  onChanged: () => Promise<unknown>;
}

/** Pages of the dashboard. Shown once there is more than one, and always while editing so a page can be added. */
export function PageTabs({ pages, current, editing, onSelect, onChanged }: PageTabsProps) {
  const reduce = useReducedMotion();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (pages.length < 2 && !editing) return null;

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const result = await addPage(name);
    if (!result.ok) return setError(result.error);
    setError(null);
    setName("");
    setAdding(false);
    await onChanged();
    onSelect(result.id);
  };

  return (
    <nav className={styles.bar} aria-label="Pages">
      <div className={`${glassClass("pill")} ${styles.tabs}`} role="tablist" aria-label="Pages">
        {pages.map((page, index) => {
          const active = page.id === current;
          return (
            <div key={page.id} className={styles.tabWrap}>
              {editing && active ? (
                <span className={styles.tab} data-active>
                  <motion.span layoutId="page-highlight" className={styles.highlight} transition={reduce ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />
                  <InlineEdit variant="body" className={styles.label} label={`Rename ${page.name}`} value={page.name}
                    onSave={async next => { const result = await renamePage(page.id, next); if (!result.ok) throw new Error(result.error); await onChanged(); }} validate={next => next.trim() ? null : "Give the page a name."} />
                </span>
              ) : (
                <button type="button" role="tab" aria-selected={active} className={styles.tab} data-active={active || undefined} onClick={() => onSelect(page.id)}>
                  {active && <motion.span layoutId="page-highlight" className={styles.highlight} transition={reduce ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
                  <span className={styles.label}>{page.name}</span>
                </button>
              )}
              {editing && active && (
                <span className={styles.tools}>
                  <button type="button" className={styles.tool} aria-label={`Move ${page.name} left`} disabled={index === 0} onClick={async () => { await movePage(page.id, -1); await onChanged(); }}><ArrowLeft size={13} strokeWidth={2} aria-hidden="true" /></button>
                  <button type="button" className={styles.tool} aria-label={`Move ${page.name} right`} disabled={index === pages.length - 1} onClick={async () => { await movePage(page.id, 1); await onChanged(); }}><ArrowRight size={13} strokeWidth={2} aria-hidden="true" /></button>
                  {pages.length > 1 && (
                    <button type="button" className={styles.tool} aria-label={`Delete ${page.name}`} onClick={async () => { await deletePage(page.id); await onChanged(); onSelect(pages[index === 0 ? 1 : 0].id); }}><Trash2 size={13} strokeWidth={2} aria-hidden="true" /></button>
                  )}
                </span>
              )}
            </div>
          );
        })}
        {editing && (
          <Popover open={adding} onOpenChange={setAdding}>
            <PopoverTrigger asChild>
              <button type="button" className={styles.add} aria-label="New page"><Plus size={15} strokeWidth={1.9} aria-hidden="true" /></button>
            </PopoverTrigger>
            <PopoverContent className={`${glassSheetClass} ${styles.popover}`}>
              <form className={styles.form} onSubmit={create}>
                <Input label="New page" value={name} onChange={event => setName(event.target.value)} placeholder="Kitchen, Wall tablet, Kids" maxLength={30} autoFocus error={error ?? undefined} />
                <Button type="submit" disabled={!name.trim()}>Add page</Button>
              </form>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </nav>
  );
}
