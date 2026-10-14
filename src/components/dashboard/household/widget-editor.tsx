"use client";

import { Package as PackageIcon, Pencil, Plus, Trash2, WashingMachine } from "lucide-react";
import { useHome } from "../use-home";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Select } from "@/components/arc/select/select";
import { Switch } from "@/components/arc/switch/switch";
import { glassSheetClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { clearNotes, deleteWidgetItem, saveWidgetItem } from "@/lib/widget-actions";
import { BIN_ICONS, CARRIERS, itemsOf, type ItemData, type ItemKind, type WidgetItem } from "@/lib/widgets/items";
import { CARRIER_NAMES, detectCarrier, packageSource, type Carrier } from "@/lib/widgets/packages";
import { localDay, nextPickup } from "@/lib/widgets/schedules";
import { BIN_ICON_COMPONENTS } from "./bins-tile";
import { ColorChoice, EmojiChoice, Field, weekdayName, WeekdayChoice } from "./choices";
import styles from "./widget-editor.module.css";

/** Which item kind each household tile keeps. */
export const ITEM_KIND_FOR = { bins: "bin", medications: "medication", countdown: "countdown", notes: "note", wifi: "wifi", timers: "timer", plants: "plant", packages: "package", appliances: "appliance" } as const satisfies Record<string, ItemKind>;
export type HouseholdKind = keyof typeof ITEM_KIND_FOR;
export const isHousehold = (kind: string): kind is HouseholdKind => kind in ITEM_KIND_FOR;

export interface WidgetEditorState {
  kind: HouseholdKind;
  tile: TileConfig;
  itemId?: string;
}

interface WidgetEditorProps {
  state: WidgetEditorState | null;
  items: WidgetItem[];
  onOpenChange: (open: boolean) => void;
  /** Countdown and Wi-Fi tiles show one item; this links a saved one to its tile. */
  onLink: (tileId: string, itemId: string) => void;
}

const TITLES: Record<HouseholdKind, [string, string]> = {
  bins: ["Bin day", "Each bin, the day it is collected, and how often."],
  medications: ["Medications", "Who takes what, and when. Doses reset each day."],
  countdown: ["Countdown", "A date to count down to."],
  notes: ["Note board", "Notes are added from the board itself."],
  wifi: ["Guest Wi-Fi", "The password is encrypted, and only shown on your dashboard."],
  timers: ["New timer", "Every open screen counts down together."],
  plants: ["Plants", "How often each one needs water."],
  packages: ["Packages", "What is on the way. Paste a tracking number and Hearth links to it."],
  appliances: ["Laundry and dishes", "Pick the power plug or monitor each one runs on. Hearth spots a cycle from the power it draws."],
};

export function WidgetEditor({ state, items, onOpenChange, onLink }: WidgetEditorProps) {
  const [title, description] = state ? TITLES[state.kind] : ["", ""];
  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={title} description={description}>
        {state && <Body key={`${state.kind}-${state.tile.id}-${state.itemId ?? ""}`} state={state} items={items} close={() => onOpenChange(false)} onLink={onLink} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ state, items, close, onLink }: { state: WidgetEditorState; items: WidgetItem[]; close: () => void; onLink: WidgetEditorProps["onLink"] }) {
  switch (state.kind) {
    case "bins": return <Collection kind="bin" items={itemsOf(items, "bin")} start={state.itemId} describe={describeBin} form={BinForm} addLabel="Add a bin" />;
    case "medications": return <Collection kind="medication" items={itemsOf(items, "medication")} start={state.itemId} describe={describeMedication} form={MedicationForm} addLabel="Add a medication" />;
    case "plants": return <Collection kind="plant" items={itemsOf(items, "plant")} start={state.itemId} describe={describePlant} form={PlantForm} addLabel="Add a plant" />;
    case "appliances": return <Collection kind="appliance" items={itemsOf(items, "appliance")} start={state.itemId} describe={describeAppliance} form={ApplianceForm} addLabel="Add an appliance" />;
    case "packages": return <Collection kind="package" items={itemsOf(items, "package")} start={state.itemId} describe={describePackage} form={PackageForm} addLabel="Add a package" />;
    case "countdown": return <Single kind="countdown" item={itemsOf(items, "countdown").find(item => item.id === (state.itemId ?? state.tile.options?.itemId))} form={CountdownForm} onSaved={id => { onLink(state.tile.id, id); close(); }} />;
    case "wifi": return <Single kind="wifi" item={itemsOf(items, "wifi").find(item => item.id === (state.itemId ?? state.tile.options?.itemId))} form={WifiForm} onSaved={id => { onLink(state.tile.id, id); close(); }} />;
    case "timers": return <Single kind="timer" form={TimerForm} onSaved={() => close()} />;
    case "notes": return <NotesManager notes={itemsOf(items, "note")} close={close} />;
  }
}

type FormProps<K extends ItemKind> = { initial?: ItemData<K>; onSubmit: (data: unknown) => Promise<boolean>; onCancel?: () => void; submitLabel: string };

/** A list of items with edit and remove, and a form for a new one or the one being edited. */
function Collection<K extends "bin" | "medication" | "plant" | "package" | "appliance">({ kind, items, start, describe, form: Form, addLabel }: {
  kind: K; items: WidgetItem<K>[]; start?: string; describe: (data: ItemData<K>) => { title: string; detail: string; color?: string; icon?: ReactNode }; form: (props: FormProps<K>) => ReactNode; addLabel: string;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(start ?? (items.length ? null : "new"));
  const [error, setError] = useState<string | null>(null);
  const submit = (id?: string) => async (data: unknown) => {
    const result = await saveWidgetItem(kind, data, id);
    setError(result.ok ? null : result.error);
    if (result.ok) setEditing(null);
    return result.ok;
  };
  const current = items.find(item => item.id === editing);
  return (
    <div className={styles.body}>
      {items.length > 0 && (
        <ul className={styles.items}>
          {items.map(item => {
            const shown = describe(item.data);
            return (
              <li key={item.id} className={styles.item} data-editing={editing === item.id || undefined} style={shown.color ? { "--item": shown.color } as CSSProperties : undefined}>
                <span className={styles.itemIcon} aria-hidden="true">{shown.icon}</span>
                <span className={styles.itemText}>
                  <span className={styles.itemTitle}>{shown.title}</span>
                  <span className={styles.itemDetail}>{shown.detail}</span>
                </span>
                <Button variant="ghost" size="sm" aria-label={`Edit ${shown.title}`} onClick={() => setEditing(item.id)}><Pencil size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
                <Button variant="ghost" size="sm" aria-label={`Remove ${shown.title}`} onClick={() => { void deleteWidgetItem(item.id); if (editing === item.id) setEditing(null); }}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
              </li>
            );
          })}
        </ul>
      )}
      {editing ? (
        <div className={styles.form}>
          <Form key={editing} initial={current?.data} onSubmit={submit(current?.id)} onCancel={items.length ? () => setEditing(null) : undefined} submitLabel={current ? "Save" : addLabel} />
          <Alert tone="danger" title="Could not save" open={Boolean(error)}>{error ?? ""}</Alert>
        </div>
      ) : (
        <Button variant="secondary" className={styles.add} onClick={() => setEditing("new")}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> {addLabel}</Button>
      )}
    </div>
  );
}

function Single<K extends "countdown" | "wifi" | "timer">({ kind, item, form: Form, onSaved }: { kind: K; item?: WidgetItem<K>; form: (props: FormProps<K>) => ReactNode; onSaved: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={styles.body}>
      <Form initial={item?.data} submitLabel={item ? "Save" : kind === "timer" ? "Start timer" : "Save"} onSubmit={async data => {
        const result = await saveWidgetItem(kind, data, item?.id);
        setError(result.ok ? null : result.error);
        if (result.ok) onSaved(result.id);
        return result.ok;
      }} />
      <Alert tone="danger" title="Could not save" open={Boolean(error)}>{error ?? ""}</Alert>
    </div>
  );
}

function Actions({ submitLabel, onCancel, pending }: { submitLabel: string; onCancel?: () => void; pending: boolean }) {
  return (
    <div className={styles.actions}>
      {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      <Button type="submit" loading={pending}>{submitLabel}</Button>
    </div>
  );
}

function useSubmit(onSubmit: (data: unknown) => Promise<boolean>) {
  const [pending, setPending] = useState(false);
  return {
    pending,
    submit: async (event: FormEvent, data: () => unknown) => {
      event.preventDefault();
      setPending(true);
      await onSubmit(data());
      setPending(false);
    },
  };
}

const BIN_PRESETS: { name: string; icon: ItemData<"bin">["icon"]; color: string }[] = [
  { name: "Garbage", icon: "trash", color: "#6b7280" }, { name: "Recycling", icon: "recycle", color: "#3b82f6" }, { name: "Compost", icon: "leaf", color: "#22c55e" },
  { name: "Yard waste", icon: "tree", color: "#a16207" }, { name: "Glass", icon: "wine", color: "#14b8a6" }, { name: "Cardboard", icon: "package", color: "#f59e0b" },
];
const EVERY_LABEL: Record<1 | 2 | 4, string> = { 1: "Every", 2: "Every other", 4: "Every fourth" };

function describeBin(bin: ItemData<"bin">) {
  const Icon = BIN_ICON_COMPONENTS[bin.icon];
  return { title: bin.name, detail: `${EVERY_LABEL[bin.every]} ${weekdayName(bin.weekday)}, next ${new Date(`${nextPickup(bin, new Date())}T12:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, color: bin.color, icon: <Icon size={16} strokeWidth={1.75} /> };
}

function BinForm({ initial, onSubmit, onCancel, submitLabel }: FormProps<"bin">) {
  const [bin, setBin] = useState<ItemData<"bin">>(() => initial ?? { name: "Garbage", icon: "trash", color: "#6b7280", weekday: 3, every: 1, start: localDay(new Date()) });
  const { pending, submit } = useSubmit(onSubmit);
  const set = (patch: Partial<ItemData<"bin">>) => setBin(current => ({ ...current, ...patch }));
  return (
    <form className={styles.fields} onSubmit={event => submit(event, () => bin)}>
      <Field label="Quick start">
        <div className={styles.chips}>
          {BIN_PRESETS.map(preset => {
            const Icon = BIN_ICON_COMPONENTS[preset.icon];
            return (
              <button key={preset.name} type="button" className={styles.chip} data-on={bin.name === preset.name || undefined} style={{ "--item": preset.color } as CSSProperties} onClick={() => set(preset)}>
                <Icon size={14} strokeWidth={2} aria-hidden="true" /> {preset.name}
              </button>
            );
          })}
        </div>
      </Field>
      <Input label="Name" value={bin.name} onChange={event => set({ name: event.target.value })} maxLength={40} required />
      <Field label="Icon">
        <div className={styles.icons} role="radiogroup" aria-label="Icon">
          {BIN_ICONS.map(icon => {
            const Icon = BIN_ICON_COMPONENTS[icon];
            return <button key={icon} type="button" role="radio" aria-checked={bin.icon === icon} aria-label={icon} className={styles.iconOption} style={{ "--item": bin.color } as CSSProperties} onClick={() => set({ icon })}><Icon size={18} strokeWidth={1.75} aria-hidden="true" /></button>;
          })}
        </div>
      </Field>
      <ColorChoice value={bin.color} onChange={color => set({ color })} label="Bin colour" />
      <WeekdayChoice value={[bin.weekday]} onChange={([weekday]) => set({ weekday })} label="Pickup day" />
      <SegmentedControl label="How often" value={String(bin.every)} onValueChange={value => set({ every: Number(value) as 1 | 2 | 4 })} options={[{ value: "1", label: "Weekly" }, { value: "2", label: "Every 2 weeks" }, { value: "4", label: "Every 4 weeks" }]} />
      {bin.every > 1 && <Input label="A recent or upcoming pickup" type="date" value={bin.start} onChange={event => set({ start: event.target.value })} description="So Hearth knows which weeks it comes." required />}
      <Actions submitLabel={submitLabel} onCancel={onCancel} pending={pending} />
    </form>
  );
}

function describeMedication(medication: ItemData<"medication">) {
  const days = medication.weekdays.length ? medication.weekdays.map(day => weekdayName(day).slice(0, 3)).join(", ") : "Every day";
  return { title: `${medication.name}${medication.dose ? ` · ${medication.dose}` : ""}`, detail: `${medication.person ? `${medication.person} · ` : ""}${days} at ${medication.times.join(", ")}`, color: medication.color, icon: <span className={styles.dot} /> };
}

function MedicationForm({ initial, onSubmit, onCancel, submitLabel }: FormProps<"medication">) {
  const [medication, setMedication] = useState<ItemData<"medication">>(initial ?? { name: "", dose: "", person: "", times: ["08:00"], weekdays: [], color: "#ec4899", supply: null, taken: {} });
  const { pending, submit } = useSubmit(onSubmit);
  const set = (patch: Partial<ItemData<"medication">>) => setMedication(current => ({ ...current, ...patch }));
  return (
    <form className={styles.fields} onSubmit={event => submit(event, () => medication)}>
      <div className={styles.pair}>
        <Input label="Medication" value={medication.name} onChange={event => set({ name: event.target.value })} placeholder="Vitamin D" maxLength={40} required />
        <Input label="Dose" value={medication.dose} onChange={event => set({ dose: event.target.value })} placeholder="1 tablet" maxLength={40} />
      </div>
      <Input label="For" value={medication.person} onChange={event => set({ person: event.target.value })} placeholder="Grandma, Max, the dog" maxLength={30} />
      <Field label="Times">
        <div className={styles.times}>
          {medication.times.map((time, index) => (
            <span key={index} className={styles.time}>
              <input type="time" className={styles.timeInput} value={time} aria-label={`Dose ${index + 1}`} required onChange={event => set({ times: medication.times.map((value, position) => position === index ? event.target.value : value) })} />
              {medication.times.length > 1 && <button type="button" className={styles.timeRemove} aria-label={`Remove dose ${index + 1}`} onClick={() => set({ times: medication.times.filter((_, position) => position !== index) })}>×</button>}
            </span>
          ))}
          {medication.times.length < 6 && <Button type="button" variant="ghost" size="sm" onClick={() => set({ times: [...medication.times, medication.times.length === 1 ? "20:00" : "12:00"] })}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add a time</Button>}
        </div>
      </Field>
      <WeekdayChoice multiple value={medication.weekdays} onChange={weekdays => set({ weekdays })} label="Days (none chosen means every day)" />
      <ColorChoice value={medication.color} onChange={color => set({ color })} />
      <Input label="Doses left (optional)" type="number" min={0} max={10000} value={medication.supply ?? ""} onChange={event => set({ supply: event.target.value === "" ? null : Math.max(0, Math.round(Number(event.target.value))) })} description="Counts down as doses are taken, with a refill reminder at a week left." />
      <Actions submitLabel={submitLabel} onCancel={onCancel} pending={pending} />
    </form>
  );
}

const PLANT_EMOJI = ["🪴", "🌿", "🌵", "🌱", "🌸", "🌻", "🍀", "🌳", "🎋", "🌺"];
const AGO: { label: string; days: number }[] = [{ label: "Today", days: 0 }, { label: "Yesterday", days: 1 }, { label: "3 days ago", days: 3 }, { label: "A week ago", days: 7 }];

function describePlant(plant: ItemData<"plant">) {
  return { title: plant.name, detail: `Every ${plant.everyDays} ${plant.everyDays === 1 ? "day" : "days"}${plant.place ? ` · ${plant.place}` : ""}`, icon: <span className={styles.emoji}>{plant.emoji}</span> };
}

function PlantForm({ initial, onSubmit, onCancel, submitLabel }: FormProps<"plant">) {
  const [plant, setPlant] = useState<ItemData<"plant">>(() => initial ?? { name: "", emoji: "🪴", everyDays: 7, lastWatered: new Date().toISOString(), place: "" });
  const [ago, setAgo] = useState(initial ? -1 : 0);
  const { pending, submit } = useSubmit(onSubmit);
  const set = (patch: Partial<ItemData<"plant">>) => setPlant(current => ({ ...current, ...patch }));
  return (
    <form className={styles.fields} onSubmit={event => submit(event, () => ago < 0 ? plant : { ...plant, lastWatered: new Date(Date.now() - ago * 86_400_000).toISOString() })}>
      <div className={styles.pair}>
        <Input label="Plant" value={plant.name} onChange={event => set({ name: event.target.value })} placeholder="Monstera" maxLength={40} required />
        <Input label="Where" value={plant.place} onChange={event => set({ place: event.target.value })} placeholder="Living room" maxLength={30} />
      </div>
      <EmojiChoice value={plant.emoji} onChange={emoji => set({ emoji })} options={PLANT_EMOJI} />
      <Field label="Water every">
        <div className={styles.chips}>
          {[2, 3, 5, 7, 10, 14].map(days => <button key={days} type="button" className={styles.chip} data-on={plant.everyDays === days || undefined} onClick={() => set({ everyDays: days })}>{days} days</button>)}
          <input type="number" className={styles.number} min={1} max={60} value={plant.everyDays} aria-label="Days between waterings" onChange={event => set({ everyDays: Math.min(60, Math.max(1, Math.round(Number(event.target.value) || 1))) })} />
        </div>
      </Field>
      <SegmentedControl label="Last watered" value={String(ago)} onValueChange={value => setAgo(Number(value))} options={[...(initial ? [{ value: "-1", label: "Keep" }] : []), ...AGO.map(option => ({ value: String(option.days), label: option.label }))]} />
      <Actions submitLabel={submitLabel} onCancel={onCancel} pending={pending} />
    </form>
  );
}

const APPLIANCE_TYPES = [{ value: "washer", label: "Washer" }, { value: "dryer", label: "Dryer" }, { value: "dishwasher", label: "Dishwasher" }, { value: "other", label: "Something else" }];

function describeAppliance(item: ItemData<"appliance">) {
  return { title: item.name, detail: `${APPLIANCE_TYPES.find(type => type.value === item.type)?.label ?? "Appliance"} · runs above ${item.threshold} W`, icon: <WashingMachine size={18} strokeWidth={1.75} /> };
}

function ApplianceForm({ initial, onSubmit, onCancel, submitLabel }: FormProps<"appliance">) {
  const { home } = useHome();
  const sensors = (home?.devices ?? []).filter(device => device.kind === "sensor" && device.sensorClass === "power");
  const [item, setItem] = useState<ItemData<"appliance">>(() => initial ?? { name: "Washer", type: "washer", sensorId: sensors.find(sensor => /wash|dry|dish/i.test(sensor.name))?.id ?? sensors[0]?.id ?? "", threshold: 5, emptiedAt: null });
  const { pending, submit } = useSubmit(onSubmit);
  const set = (patch: Partial<ItemData<"appliance">>) => setItem(current => ({ ...current, ...patch }));
  return (
    <form className={styles.fields} onSubmit={event => submit(event, () => item)}>
      <div className={styles.pair}>
        <Input label="Name" value={item.name} onChange={event => set({ name: event.target.value })} maxLength={30} required />
        <Select label="It is a" value={item.type} onValueChange={value => set({ type: value as ItemData<"appliance">["type"], name: item.name === APPLIANCE_TYPES.find(type => type.value === item.type)?.label ? APPLIANCE_TYPES.find(type => type.value === value)?.label ?? item.name : item.name })} options={APPLIANCE_TYPES} />
      </div>
      {sensors.length ? (
        <Select label="Power sensor" value={item.sensorId} onValueChange={sensorId => set({ sensorId })} options={sensors.map(sensor => ({ value: sensor.id, label: sensor.room ? `${sensor.name} · ${sensor.room}` : sensor.name }))} />
      ) : <p className={styles.note}>No power sensors yet. Plug it into a smart plug that measures power, and it shows up here.</p>}
      <Input label="Running above (watts)" type="number" min={1} max={500} value={item.threshold} onChange={event => set({ threshold: Math.min(500, Math.max(1, Number(event.target.value) || 5)) })} description="Most machines idle under 5 W." />
      <Actions submitLabel={submitLabel} onCancel={onCancel} pending={pending} />
    </form>
  );
}

function describePackage(item: ItemData<"package">) {
  const due = item.expected ? new Date(`${item.expected}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
  const where = packageSource(item);
  const state = item.status === "collected" ? "Collected" : item.status === "delivered" ? "Delivered" : due ? `Due ${due}` : "On the way";
  return { title: item.name, detail: [where, state].filter(Boolean).join(" · "), icon: <PackageIcon size={18} strokeWidth={1.75} /> };
}

function PackageForm({ initial, onSubmit, onCancel, submitLabel }: FormProps<"package">) {
  const [item, setItem] = useState<ItemData<"package">>(() => initial ?? { name: "", from: "", carrier: "other", tracking: "", expected: localDay(new Date(Date.now() + 2 * 86_400_000)), status: "coming", deliveredAt: null, collectedAt: null, track: null });
  const [carrierPicked, setCarrierPicked] = useState(Boolean(initial));
  const { pending, submit } = useSubmit(onSubmit);
  const set = (patch: Partial<ItemData<"package">>) => setItem(current => ({ ...current, ...patch }));
  const setTracking = (tracking: string) => {
    const detected = detectCarrier(tracking);
    set({ tracking, ...(!carrierPicked && detected ? { carrier: detected } : {}), ...(!item.from && detected === "amazon" ? { from: "Amazon" } : {}) });
  };
  return (
    <form className={styles.fields} onSubmit={event => submit(event, () => item)}>
      <div className={styles.pair}>
        <Input label="What is it" value={item.name} onChange={event => set({ name: event.target.value })} placeholder="New headphones" maxLength={50} required />
        <Input label="From" value={item.from} onChange={event => set({ from: event.target.value })} placeholder="Amazon" maxLength={30} />
      </div>
      <Input label="Tracking number" value={item.tracking} onChange={event => setTracking(event.target.value)} placeholder="Optional, such as TBA123456789000" maxLength={60} autoComplete="off" spellCheck={false}
        description={!item.tracking ? undefined : item.carrier === "amazon" ? "Amazon numbers track on Amazon only, so the tile links there." : "With 17TRACK in Home Assistant, Hearth follows this number and marks it delivered."} />
      <div className={styles.pair}>
        <Select label="Carrier" value={item.carrier} onValueChange={value => { setCarrierPicked(true); set({ carrier: value as Carrier }); }} options={CARRIERS.map(value => ({ value, label: CARRIER_NAMES[value] }))} />
        <Input label="Expected" type="date" value={item.expected ?? ""} onChange={event => set({ expected: event.target.value || null })} />
      </div>
      {initial && <SegmentedControl label="Status" value={item.status} onValueChange={value => set({ status: value as ItemData<"package">["status"] })} options={[{ value: "coming", label: "On the way" }, { value: "delivered", label: "Delivered" }, { value: "collected", label: "Collected" }]} />}
      <Actions submitLabel={submitLabel} onCancel={onCancel} pending={pending} />
    </form>
  );
}

const COUNTDOWN_EMOJI = ["🎉", "✈️", "🎂", "🏖️", "🎄", "💍", "🎓", "👶", "🏠", "🎃", "❤️", "⚽️"];

function CountdownForm({ initial, onSubmit, submitLabel }: FormProps<"countdown">) {
  const [countdown, setCountdown] = useState<ItemData<"countdown">>(() => initial ?? { title: "", date: localDay(new Date(Date.now() + 30 * 86_400_000)), emoji: "🎉", color: "#8b5cf6", yearly: false });
  const { pending, submit } = useSubmit(onSubmit);
  const set = (patch: Partial<ItemData<"countdown">>) => setCountdown(current => ({ ...current, ...patch }));
  return (
    <form className={styles.fields} onSubmit={event => submit(event, () => countdown)}>
      <Input label="What for" value={countdown.title} onChange={event => set({ title: event.target.value })} placeholder="Japan trip" maxLength={50} required />
      <Input label="Date" type="date" value={countdown.date} onChange={event => set({ date: event.target.value })} required />
      <EmojiChoice value={countdown.emoji} onChange={emoji => set({ emoji })} options={COUNTDOWN_EMOJI} />
      <ColorChoice value={countdown.color} onChange={color => set({ color })} />
      <Switch label="Repeats every year, like a birthday" checked={countdown.yearly} onCheckedChange={yearly => set({ yearly })} />
      <Actions submitLabel={submitLabel} pending={pending} />
    </form>
  );
}

function WifiForm({ initial, onSubmit, submitLabel }: FormProps<"wifi">) {
  const [wifi, setWifi] = useState<ItemData<"wifi">>(initial ?? { ssid: "", password: "", security: "WPA", hidden: false });
  const { pending, submit } = useSubmit(onSubmit);
  const set = (patch: Partial<ItemData<"wifi">>) => setWifi(current => ({ ...current, ...patch }));
  return (
    <form className={styles.fields} onSubmit={event => submit(event, () => wifi)}>
      <Input label="Network name" value={wifi.ssid} onChange={event => set({ ssid: event.target.value })} placeholder="Home Guest" maxLength={32} required autoComplete="off" />
      <Select label="Security" value={wifi.security} onValueChange={value => set({ security: value as ItemData<"wifi">["security"] })} options={[{ value: "WPA", label: "WPA, WPA2, or WPA3" }, { value: "WEP", label: "WEP" }, { value: "nopass", label: "None" }]} />
      {wifi.security !== "nopass" && <PasswordField label="Password" value={wifi.password} onChange={event => set({ password: event.target.value })} maxLength={63} autoComplete="off" />}
      <Switch label="The network is hidden" checked={wifi.hidden} onCheckedChange={hidden => set({ hidden })} />
      <Actions submitLabel={submitLabel} pending={pending} />
    </form>
  );
}

function TimerForm({ onSubmit, submitLabel }: FormProps<"timer">) {
  const [label, setLabel] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [seconds, setSeconds] = useState(0);
  const [start, setStart] = useState(true);
  const { pending, submit } = useSubmit(onSubmit);
  const durationMs = Math.max(1000, (minutes * 60 + seconds) * 1000);
  return (
    <form className={styles.fields} onSubmit={event => submit(event, () => ({ label: label.trim() || `${minutes} min`, durationMs, remainingMs: durationMs, endsAt: start ? new Date(Date.now() + durationMs).toISOString() : null }))}>
      <Input label="Name" value={label} onChange={event => setLabel(event.target.value)} placeholder="Pasta, laundry, homework" maxLength={30} />
      <Field label="Length">
        <div className={styles.chips}>
          {[1, 3, 5, 10, 15, 20, 30, 45, 60].map(value => <button key={value} type="button" className={styles.chip} data-on={minutes === value && seconds === 0 || undefined} onClick={() => { setMinutes(value); setSeconds(0); }}>{value} min</button>)}
        </div>
      </Field>
      <div className={styles.pair}>
        <Input label="Minutes" type="number" min={0} max={1440} value={minutes} onChange={event => setMinutes(Math.max(0, Math.round(Number(event.target.value) || 0)))} />
        <Input label="Seconds" type="number" min={0} max={59} value={seconds} onChange={event => setSeconds(Math.min(59, Math.max(0, Math.round(Number(event.target.value) || 0))))} />
      </div>
      <Switch label="Start now" checked={start} onCheckedChange={setStart} />
      <Actions submitLabel={start ? submitLabel : "Add timer"} pending={pending} />
    </form>
  );
}

function NotesManager({ notes, close }: { notes: WidgetItem<"note">[]; close: () => void }) {
  return (
    <div className={styles.body}>
      <p className={styles.itemDetail}>{notes.length ? `${notes.length} ${notes.length === 1 ? "note is" : "notes are"} on the board. Tear one off with its ×.` : "The board is empty. Write on it from the tile."}</p>
      {notes.length > 0 && <Button variant="secondary" onClick={async () => { await clearNotes(notes.map(note => note.id)); close(); }}>Clear the board</Button>}
    </div>
  );
}
