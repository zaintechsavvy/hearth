"use client";

import { MapPin, MoreHorizontal, Plus, Sunrise, Sunset, Workflow } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Switch } from "@/components/arc/switch/switch";
import { PlaceSearch } from "@/components/dashboard/place-search";
import { useHome } from "@/components/dashboard/use-home";
import { Glass, glassSheetClass } from "@/components/glass/glass";
import { deleteAutomation, runAutomation, saveHomeLocation, setAutomationEnabled, snoozeAutomation } from "@/lib/actions";
import { summarize } from "@/lib/automations/logic";
import type { Automation, AutomationInput, HomeLocation } from "@/lib/automations/types";
import { AutomationEditor } from "./automation-editor";
import { TEMPLATES } from "./templates";
import styles from "./automations.module.css";

interface Listing {
  automations: Automation[];
  location: HomeLocation | null;
  sun: { sunrise: string; sunset: string } | null;
}

const fetchListing = async (url: string): Promise<Listing> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Automations are unavailable.");
  return response.json();
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const HOUR_MS = 3_600_000;
const IDEAS_SHOWN = 3;
const tomorrow = () => { const date = new Date(); date.setHours(24, 0, 0, 0); return date; };
const snoozeWords = (iso: string) => {
  const until = new Date(iso);
  return `Snoozed until ${until.toDateString() === new Date().toDateString() ? clock(iso) : until.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
};

/** Rules that run the home by themselves, ready-made or built from scratch. */
export function AutomationsView() {
  const { home } = useHome();
  const { data, mutate, isLoading } = useSWR<Listing>("/api/automations", fetchListing, { refreshInterval: 30_000 });
  const [draft, setDraft] = useState<(AutomationInput & { id?: string }) | null>(null);
  const [placing, setPlacing] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);
  const devices = home?.devices ?? [];
  const byId = new Map(devices.map(device => [device.id, device]));
  const scenes = new Map((home?.scenes ?? []).map(scene => [scene.id, scene]));
  const templates = TEMPLATES.map(template => ({ template, rule: template.build(devices) })).filter(entry => entry.rule && !data?.automations.some(rule => rule.name === entry.rule?.name));

  const snooze = async (id: string, until: Date | null) => {
    const snoozedUntil = until?.toISOString() ?? null;
    await mutate(current => current && { ...current, automations: current.automations.map(rule => rule.id === id ? { ...rule, snoozedUntil } : rule) }, { revalidate: false });
    await snoozeAutomation(id, snoozedUntil);
    await mutate();
  };

  const blank = (): AutomationInput => ({ name: "New automation", enabled: true, trigger: { type: "time", at: "07:00", days: [] }, conditions: [], actions: [{ type: "notify", title: "Good morning", body: "" }] });

  const remove = async (id: string) => {
    await deleteAutomation(id);
    setDraft(null);
    await mutate();
  };
  const usesSun = Boolean(data?.automations.some(rule => rule.trigger.type === "sun" || rule.conditions.some(condition => condition.type === "sun")));
  const ideas = showIdeas || !data?.automations.length ? templates : templates.slice(0, IDEAS_SHOWN);

  return (
    <div className={styles.page}>
      <header className={styles.header} data-on-wall>
        <div>
          <h1 className={styles.title}>Automations</h1>
          <p className={styles.lede}>Rules that run your home on their own.</p>
        </div>
        <Button onClick={() => setDraft(blank())} aria-label="New automation"><Plus size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.newLabel}>New automation</span></Button>
      </header>

      {isLoading && !data ? <Glass shape="panel" className={styles.panel}><Skeleton lines={3} label="Loading automations" /></Glass>
        : data?.automations.length ? (
          <Glass shape="panel" className={styles.panel}>
            <ul className={styles.rows} aria-label="Your automations">
              {data.automations.map(rule => (
                <li key={rule.id} className={styles.row} data-off={!rule.enabled || Boolean(rule.snoozedUntil) || undefined}>
                  <button type="button" className={styles.rowMain} onClick={() => setDraft({ ...rule })} aria-label={`Edit ${rule.name}`}>
                    <span className={styles.rowTitle}>{rule.name}</span>
                    <span className={styles.rowDetail}>{summarize(rule.trigger, rule.actions, byId, scenes)}</span>
                    <span className={styles.rowMeta}>
                      {rule.enabled && rule.snoozedUntil ? <span className={styles.snoozed}>{snoozeWords(rule.snoozedUntil)}</span>
                        : rule.lastRun ? `Last ran ${new Date(rule.lastRun).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "Has not run yet"}
                    </span>
                  </button>
                  <DropdownMenu iconOnly label={`More for ${rule.name}`} icon={<MoreHorizontal size={16} strokeWidth={1.75} />} items={[
                    { label: "Run now", onSelect: () => void runAutomation(rule.id).then(() => mutate()) },
                    ...(rule.enabled ? [
                      ...[1, 4].map(hours => ({ label: `Snooze for ${hours} ${hours === 1 ? "hour" : "hours"}`, separatorBefore: hours === 1, onSelect: () => void snooze(rule.id, new Date(Date.now() + hours * HOUR_MS)) })),
                      { label: "Snooze until tomorrow", onSelect: () => void snooze(rule.id, tomorrow()) },
                      ...(rule.snoozedUntil ? [{ label: "Resume now", onSelect: () => void snooze(rule.id, null) }] : []),
                    ] : []),
                  ]} />
                  <Switch aria-label={`${rule.name} is ${rule.enabled ? "on" : "paused"}`} checked={rule.enabled} onCheckedChange={async enabled => { await setAutomationEnabled(rule.id, enabled); await mutate(); }} />
                </li>
              ))}
            </ul>
          </Glass>
        ) : (
          <Glass shape="panel" className={styles.empty}>
            <EmptyState icon={<Workflow size={24} strokeWidth={1.75} />} title="No automations yet" description="Pick an idea below, or build one from scratch." />
          </Glass>
        )}

      {templates.length > 0 && (
        <section className={styles.ideas} aria-labelledby="ideas-title">
          <h2 id="ideas-title" className={styles.groupTitle} data-on-wall>Ideas</h2>
          <Glass shape="panel" className={styles.panel}>
            <ul className={styles.rows}>
              {ideas.map(({ template, rule }) => (
                <li key={template.id} className={styles.row}>
                  <button type="button" className={styles.rowMain} onClick={() => rule && setDraft(rule)}>
                    <span className={styles.rowTitle}>{template.title}</span>
                    <span className={styles.rowMeta}>{template.description}</span>
                  </button>
                  <Plus className={styles.rowIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
                </li>
              ))}
            </ul>
          </Glass>
          {ideas.length < templates.length && <Button variant="ghost" size="sm" className={styles.moreIdeas} onClick={() => setShowIdeas(true)}>More ideas</Button>}
        </section>
      )}

      {(data?.location || usesSun) && <div className={styles.location} data-on-wall>
        <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className={styles.locationText}>
          {data?.location ? (
            <>
              {data.location.name}
              {data.sun && <span className={styles.sun}><Sunrise size={14} strokeWidth={1.75} aria-hidden="true" /> {clock(data.sun.sunrise)} <Sunset size={14} strokeWidth={1.75} aria-hidden="true" /> {clock(data.sun.sunset)}</span>}
            </>
          ) : "Set where your home is, so sunrise and sunset rules know when to run."}
        </span>
        <Popover open={placing} onOpenChange={setPlacing}>
          <PopoverTrigger asChild><Button variant="ghost" size="sm">{data?.location ? "Change" : "Set location"}</Button></PopoverTrigger>
          <PopoverContent align="end" className={`${glassSheetClass} ${styles.placePopover}`}>
            <PlaceSearch onChoose={async place => { await saveHomeLocation(place); setPlacing(false); await mutate(); }} />
          </PopoverContent>
        </Popover>
      </div>}

      <AutomationEditor draft={draft} devices={devices} scenes={home?.scenes ?? []} hasLocation={Boolean(data?.location)} onOpenChange={open => !open && setDraft(null)} onSaved={async () => { setDraft(null); await mutate(); }} onDelete={remove} />
    </div>
  );
}
