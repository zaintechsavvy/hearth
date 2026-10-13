"use client";

import { MapPin, Play, Plus, Sunrise, Sunset, Workflow } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Switch } from "@/components/arc/switch/switch";
import { PlaceSearch } from "@/components/dashboard/place-search";
import { useHome } from "@/components/dashboard/use-home";
import { Glass, glassSheetClass } from "@/components/glass/glass";
import { deleteAutomation, runAutomation, saveHomeLocation, setAutomationEnabled } from "@/lib/actions";
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

/** Rules that run the home by themselves, ready-made or built from scratch. */
export function AutomationsView() {
  const { home } = useHome();
  const { data, mutate, isLoading } = useSWR<Listing>("/api/automations", fetchListing, { refreshInterval: 30_000 });
  const [draft, setDraft] = useState<(AutomationInput & { id?: string }) | null>(null);
  const [placing, setPlacing] = useState(false);
  const devices = home?.devices ?? [];
  const byId = new Map(devices.map(device => [device.id, device]));
  const scenes = new Map((home?.scenes ?? []).map(scene => [scene.id, scene]));
  const templates = TEMPLATES.map(template => ({ template, rule: template.build(devices) })).filter(entry => entry.rule && !data?.automations.some(rule => rule.name === entry.rule?.name));

  const blank = (): AutomationInput => ({ name: "New automation", enabled: true, trigger: { type: "time", at: "07:00", days: [] }, conditions: [], actions: [{ type: "notify", title: "Good morning", body: "" }] });

  return (
    <div className={styles.page}>
      <header className={styles.header} data-on-wall>
        <div>
          <h1 className={styles.title}>Automations</h1>
          <p className={styles.lede}>Rules that run your home on their own. They never unlock a door or open a garage.</p>
        </div>
        <Button onClick={() => setDraft(blank())}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> New automation</Button>
      </header>

      <Glass shape="panel" className={styles.location}>
        <MapPin size={18} strokeWidth={1.75} aria-hidden="true" />
        <span className={styles.locationText}>
          {data?.location ? (
            <>
              <b>{data.location.name}</b>
              {data.sun && <span className={styles.sun}><Sunrise size={14} strokeWidth={1.75} aria-hidden="true" /> {clock(data.sun.sunrise)} <Sunset size={14} strokeWidth={1.75} aria-hidden="true" /> {clock(data.sun.sunset)}</span>}
            </>
          ) : "Set where your home is, for sunrise and sunset rules."}
        </span>
        <Popover open={placing} onOpenChange={setPlacing}>
          <PopoverTrigger asChild><Button variant="secondary" size="sm">{data?.location ? "Change" : "Set location"}</Button></PopoverTrigger>
          <PopoverContent align="end" className={`${glassSheetClass} ${styles.placePopover}`}>
            <PlaceSearch onChoose={async place => { await saveHomeLocation(place); setPlacing(false); await mutate(); }} />
          </PopoverContent>
        </Popover>
      </Glass>

      {templates.length > 0 && (
        <section className={styles.templates} aria-labelledby="templates-title">
          <h2 id="templates-title" className={styles.groupTitle} data-on-wall>Start from an idea</h2>
          <div className={styles.templateGrid}>
            {templates.map(({ template, rule }) => (
              <button key={template.id} type="button" className={`${styles.template}`} onClick={() => rule && setDraft(rule)}>
                <span className={styles.templateTitle}>{template.title}</span>
                <span className={styles.templateText}>{template.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="yours-title" className={styles.list}>
        <h2 id="yours-title" className={styles.groupTitle} data-on-wall>Yours</h2>
        {isLoading && !data ? <Glass shape="panel" className={styles.card}><Skeleton lines={3} label="Loading automations" /></Glass>
          : !data?.automations.length ? (
            <Glass shape="panel" className={styles.empty}>
              <EmptyState icon={<Workflow size={24} strokeWidth={1.75} />} title="No automations yet" description="Start from an idea above, or build one from scratch." />
            </Glass>
          ) : data.automations.map(rule => (
            <Glass key={rule.id} shape="panel" className={styles.card} data-off={!rule.enabled || undefined}>
              <div className={styles.cardText}>
                <span className={styles.cardTitle}>{rule.name}</span>
                <span className={styles.cardSentence}>{summarize(rule.trigger, rule.actions, byId, scenes)}</span>
                <span className={styles.cardMeta}>{rule.lastRun ? `Last ran ${new Date(rule.lastRun).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "Has not run yet"}{rule.conditions.length ? ` · ${rule.conditions.length} ${rule.conditions.length === 1 ? "condition" : "conditions"}` : ""}</span>
              </div>
              <div className={styles.cardActions}>
                <Button variant="ghost" size="sm" aria-label={`Run ${rule.name} now`} title="Run now" onClick={async () => { await runAutomation(rule.id); await mutate(); }}><Play size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
                <Button variant="ghost" size="sm" onClick={() => setDraft({ ...rule })}>Edit</Button>
                <ConfirmMorph label="Delete" prompt={`Delete ${rule.name}?`} pendingLabel="Deleting" doneLabel="Deleted" onConfirm={async () => { await deleteAutomation(rule.id); await mutate(); }} />
                <Switch aria-label={`${rule.name} is ${rule.enabled ? "on" : "paused"}`} checked={rule.enabled} onCheckedChange={async enabled => { await setAutomationEnabled(rule.id, enabled); await mutate(); }} />
              </div>
            </Glass>
          ))}
      </section>

      <AutomationEditor draft={draft} devices={devices} scenes={home?.scenes ?? []} hasLocation={Boolean(data?.location)} onOpenChange={open => !open && setDraft(null)} onSaved={async () => { setDraft(null); await mutate(); }} />
    </div>
  );
}
