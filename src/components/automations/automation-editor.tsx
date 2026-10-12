"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Select } from "@/components/arc/select/select";
import { Slider } from "@/components/arc/slider/slider";
import { WeekdayChoice } from "@/components/dashboard/household/choices";
import { glassSheetClass } from "@/components/glass/glass";
import { saveAutomation } from "@/lib/actions";
import { summarize } from "@/lib/automations/logic";
import { commandKey, commandOptions, matchOptions } from "@/lib/automations/options";
import type { Action, AutomationInput, Condition, StateMatch, Trigger } from "@/lib/automations/types";
import type { Device } from "@/lib/devices/types";
import type { HearthScene } from "@/lib/scenes/types";
import styles from "./automations.module.css";

interface EditorProps {
  draft: (AutomationInput & { id?: string }) | null;
  devices: Device[];
  scenes: HearthScene[];
  hasLocation: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const label = (device: Device) => `${device.name}${device.room ? ` · ${device.room}` : ""}`;
const byRoom = (devices: Device[]) => [...devices].sort((a, b) => (a.room ?? "~").localeCompare(b.room ?? "~") || a.name.localeCompare(b.name));
const CONTROLLABLE = (device: Device) => commandOptions(device).length > 0;
const WATCHABLE = (device: Device) => device.kind !== "camera" && device.kind !== "scene";

/** The when, only if, and then of one rule, with the sentence it makes shown as it is built. */
export function AutomationEditor({ draft, devices, scenes, hasLocation, onOpenChange, onSaved }: EditorProps) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={draft?.id ? "Edit automation" : "New automation"} description="When something happens, Hearth does the rest. Unlocking and opening are left to people.">
        {draft && <Body key={draft.id ?? draft.name} draft={draft} devices={devices} scenes={scenes} hasLocation={hasLocation} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <header className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {hint && <span className={styles.hint}>{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function Body({ draft, devices, scenes, hasLocation, onSaved }: Omit<EditorProps, "draft" | "onOpenChange"> & { draft: AutomationInput & { id?: string } }) {
  const [rule, setRule] = useState<AutomationInput>(draft);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const byId = new Map(devices.map(device => [device.id, device]));
  const watchable = byRoom(devices.filter(WATCHABLE));
  const controllable = byRoom(devices.filter(CONTROLLABLE));
  const set = (patch: Partial<AutomationInput>) => setRule(current => ({ ...current, ...patch }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setPending(true);
    const result = await saveAutomation(rule, draft.id);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  };

  return (
    <form className={styles.editor} onSubmit={submit}>
      <p className={styles.sentence}>{summarize(rule.trigger, rule.actions, byId, new Map(scenes.map(scene => [scene.id, scene])))}</p>
      <Input label="Name" value={rule.name} onChange={event => set({ name: event.target.value })} maxLength={60} required />

      <Section title="When">
        <TriggerFields trigger={rule.trigger} devices={watchable} byId={byId} hasLocation={hasLocation} onChange={trigger => set({ trigger })} />
      </Section>

      <Section title="Only if" hint="Optional">
        {rule.conditions.map((condition, index) => (
          <div key={index} className={styles.item}>
            <ConditionFields condition={condition} devices={watchable} byId={byId} onChange={next => set({ conditions: rule.conditions.map((item, position) => position === index ? next : item) })} />
            <Button type="button" variant="ghost" size="sm" aria-label="Remove condition" onClick={() => set({ conditions: rule.conditions.filter((_, position) => position !== index) })}><Trash2 size={15} strokeWidth={1.75} aria-hidden="true" /></Button>
          </div>
        ))}
        <div className={styles.adds}>
          <Button type="button" variant="ghost" size="sm" onClick={() => set({ conditions: [...rule.conditions, { type: "sun", when: "night" }] })}><Plus size={14} strokeWidth={1.75} aria-hidden="true" /> After dark</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => set({ conditions: [...rule.conditions, { type: "time", after: "22:00", before: "06:00" }] })}><Plus size={14} strokeWidth={1.75} aria-hidden="true" /> Between times</Button>
          {watchable.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => set({ conditions: [...rule.conditions, { type: "device", deviceId: watchable[0].id, match: matchOptions(watchable[0])[0].match }] })}><Plus size={14} strokeWidth={1.75} aria-hidden="true" /> A device is</Button>}
        </div>
      </Section>

      <Section title="Then">
        {rule.actions.map((action, index) => (
          <div key={index} className={styles.item}>
            <ActionFields action={action} devices={controllable} byId={byId} scenes={scenes} onChange={next => set({ actions: rule.actions.map((item, position) => position === index ? next : item) })} />
            {rule.actions.length > 1 && <Button type="button" variant="ghost" size="sm" aria-label="Remove step" onClick={() => set({ actions: rule.actions.filter((_, position) => position !== index) })}><Trash2 size={15} strokeWidth={1.75} aria-hidden="true" /></Button>}
          </div>
        ))}
        <div className={styles.adds}>
          {controllable.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => set({ actions: [...rule.actions, { type: "device", deviceId: controllable[0].id, command: commandOptions(controllable[0])[0].command }] })}><Plus size={14} strokeWidth={1.75} aria-hidden="true" /> Control a device</Button>}
          {scenes.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => set({ actions: [...rule.actions, { type: "scene", sceneId: scenes[0].id }] })}><Plus size={14} strokeWidth={1.75} aria-hidden="true" /> Run a scene</Button>}
          <Button type="button" variant="ghost" size="sm" onClick={() => set({ actions: [...rule.actions, { type: "notify", title: rule.name, body: "" }] })}><Plus size={14} strokeWidth={1.75} aria-hidden="true" /> Send an alert</Button>
        </div>
      </Section>

      <Alert tone="danger" title="Could not save" open={Boolean(error)}>{error ?? ""}</Alert>
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>{draft.id ? "Save" : "Create automation"}</Button>
      </div>
    </form>
  );
}

function DeviceSelect({ label: text, devices, value, onChange }: { label: string; devices: Device[]; value: string; onChange: (id: string) => void }) {
  return <Select label={text} value={value} onValueChange={onChange} options={devices.map(device => ({ value: device.id, label: label(device) }))} />;
}

function MatchFields({ device, match, onChange }: { device: Device | undefined; match: StateMatch; onChange: (match: StateMatch) => void }) {
  const options = device ? matchOptions(device) : [];
  return (
    <div className={styles.inline}>
      <Select label="State" value={match.is} onValueChange={key => { const option = options.find(item => item.key === key); if (option) onChange(option.match); }} options={options.map(option => ({ value: option.key, label: option.label }))} />
      {"value" in match && <Input label="Value" type="number" value={match.value} onChange={event => onChange({ ...match, value: Number(event.target.value) })} />}
    </div>
  );
}

function TriggerFields({ trigger, devices, byId, hasLocation, onChange }: { trigger: Trigger; devices: Device[]; byId: Map<string, Device>; hasLocation: boolean; onChange: (trigger: Trigger) => void }) {
  const kinds = [{ value: "time", label: "A time" }, { value: "sun", label: "Sunrise or sunset" }, ...(devices.length ? [{ value: "device", label: "A device changes" }] : [])];
  const pick = (type: string) => {
    if (type === "time") onChange({ type: "time", at: "07:00", days: [] });
    else if (type === "sun") onChange({ type: "sun", event: "sunset", offset: 0, days: [] });
    else onChange({ type: "device", deviceId: devices[0].id, match: matchOptions(devices[0])[0].match, forMinutes: 0 });
  };
  return (
    <div className={styles.fields}>
      <SegmentedControl label="When" value={trigger.type} onValueChange={pick} options={kinds} />
      {trigger.type === "time" && (
        <>
          <Input label="Time" type="time" value={trigger.at} onChange={event => onChange({ ...trigger, at: event.target.value })} required />
          <WeekdayChoice multiple value={trigger.days} onChange={days => onChange({ ...trigger, days })} label="Days (none chosen means every day)" />
        </>
      )}
      {trigger.type === "sun" && (
        <>
          {!hasLocation && <p className={styles.warn}>Set your home&apos;s location on the Automations page so Hearth knows when the sun rises and sets.</p>}
          <SegmentedControl label="Event" value={trigger.event} onValueChange={event => onChange({ ...trigger, event: event as "sunrise" | "sunset" })} options={[{ value: "sunrise", label: "Sunrise" }, { value: "sunset", label: "Sunset" }]} />
          <Slider label="Offset" value={trigger.offset} min={-120} max={120} step={5} format={value => value === 0 ? "Right then" : `${Math.abs(value)} min ${value < 0 ? "before" : "after"}`} onValueChange={offset => onChange({ ...trigger, offset })} />
          <WeekdayChoice multiple value={trigger.days} onChange={days => onChange({ ...trigger, days })} label="Days (none chosen means every day)" />
        </>
      )}
      {trigger.type === "device" && (
        <>
          <DeviceSelect label="Device" devices={devices} value={trigger.deviceId} onChange={deviceId => { const device = byId.get(deviceId); if (device) onChange({ ...trigger, deviceId, match: matchOptions(device)[0].match }); }} />
          <MatchFields device={byId.get(trigger.deviceId)} match={trigger.match} onChange={match => onChange({ ...trigger, match })} />
          {trigger.match.is !== "rang" && (
            <Slider label="And stays that way for" value={trigger.forMinutes} min={0} max={60} step={1} format={value => value === 0 ? "Straight away" : `${value} min`} onValueChange={forMinutes => onChange({ ...trigger, forMinutes })} />
          )}
        </>
      )}
    </div>
  );
}

function ConditionFields({ condition, devices, byId, onChange }: { condition: Condition; devices: Device[]; byId: Map<string, Device>; onChange: (condition: Condition) => void }) {
  if (condition.type === "sun") {
    return <SegmentedControl label="Only" value={condition.when} onValueChange={when => onChange({ type: "sun", when: when as "day" | "night" })} options={[{ value: "night", label: "After dark" }, { value: "day", label: "In daylight" }]} />;
  }
  if (condition.type === "time") {
    return (
      <div className={styles.inline}>
        <Input label="From" type="time" value={condition.after} onChange={event => onChange({ ...condition, after: event.target.value })} />
        <Input label="Until" type="time" value={condition.before} onChange={event => onChange({ ...condition, before: event.target.value })} />
      </div>
    );
  }
  const device = byId.get(condition.deviceId);
  const options = device ? matchOptions(device).filter(option => option.match.is !== "rang") : [];
  return (
    <div className={styles.inline}>
      <DeviceSelect label="Device" devices={devices} value={condition.deviceId} onChange={deviceId => { const next = byId.get(deviceId); if (next) onChange({ ...condition, deviceId, match: matchOptions(next)[0].match }); }} />
      <Select label="Is" value={condition.match.is} onValueChange={key => { const option = options.find(item => item.key === key); if (option) onChange({ ...condition, match: option.match }); }}
        options={options.map(option => ({ value: option.key, label: option.label.replace(/^turns /, "").replace(/^opens$/, "open").replace(/^closes$/, "closed").replace(/^locks$/, "locked").replace(/^unlocks$/, "unlocked") }))} />
    </div>
  );
}

function ActionFields({ action, devices, byId, scenes, onChange }: { action: Action; devices: Device[]; byId: Map<string, Device>; scenes: HearthScene[]; onChange: (action: Action) => void }) {
  if (action.type === "scene") return <Select label="Scene" value={action.sceneId} onValueChange={sceneId => onChange({ ...action, sceneId })} options={scenes.map(scene => ({ value: scene.id, label: scene.name }))} />;
  if (action.type === "notify") {
    return (
      <div className={styles.inline}>
        <Input label="Alert" value={action.title} onChange={event => onChange({ ...action, title: event.target.value })} maxLength={80} required />
        <Input label="Details" value={action.body} onChange={event => onChange({ ...action, body: event.target.value })} maxLength={200} />
      </div>
    );
  }
  const device = byId.get(action.deviceId);
  const options = device ? commandOptions(device) : [];
  const key = commandKey(options, action.command);
  const chosen = options.find(option => option.key === key);
  const current = action.command.type === "brightness" || action.command.type === "fanSpeed" || action.command.type === "coverPosition" || action.command.type === "targetTemperature" ? action.command.value
    : action.command.type === "temperature" ? action.command.kelvin : null;
  return (
    <div className={styles.fields}>
      <div className={styles.inline}>
        <DeviceSelect label="Device" devices={devices} value={action.deviceId} onChange={deviceId => { const next = byId.get(deviceId); if (next) onChange({ ...action, deviceId, command: commandOptions(next)[0].command }); }} />
        <Select label="Do" value={key ?? ""} onValueChange={next => { const option = options.find(item => item.key === next); if (option) onChange({ ...action, command: option.command }); }} options={options.map(option => ({ value: option.key, label: option.label }))} />
      </div>
      {chosen?.value && current !== null && (
        <Slider label={chosen.label.replace(/^Set /, "")} value={current} min={chosen.value.min} max={chosen.value.max} step={chosen.value.step}
          format={value => `${value}${chosen.value?.unit}`} onValueChange={value => chosen.value && onChange({ ...action, command: chosen.value.apply(value) })} />
      )}
    </div>
  );
}
