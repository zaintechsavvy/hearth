"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { SearchField } from "@/components/arc/search-field/search-field";
import { Select } from "@/components/arc/select/select";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { TILE_ICON_COMPONENTS } from "@/components/dashboard/tiles/tile-icons";
import { glassSheetClass } from "@/components/glass/glass";
import { chooseDevices } from "@/lib/actions";
import { defaultStyle } from "@/lib/dashboard/style";
import { kindLabel, statusText } from "@/lib/devices/status";
import type { Device } from "@/lib/devices/types";
import styles from "./device-picker.module.css";

interface Review {
  name: string;
  devices: Device[];
  unsupported: Record<string, number>;
  shown: string[];
  recommended: string[];
  fresh: string[];
}

const GROUPS = [
  { value: "all", label: "All types", kinds: [] },
  { value: "lights", label: "Lights", kinds: ["light"] },
  { value: "switches", label: "Switches and fans", kinds: ["switch", "fan"] },
  { value: "climate", label: "Climate", kinds: ["thermostat"] },
  { value: "entry", label: "Locks and doors", kinds: ["lock", "cover"] },
  { value: "sensors", label: "Sensors", kinds: ["binary_sensor", "sensor"] },
  { value: "cameras", label: "Cameras", kinds: ["camera"] },
  { value: "buttons", label: "Doorbells and buttons", kinds: ["event"] },
  { value: "scenes", label: "Scenes", kinds: ["scene"] },
] as const;

interface DevicePickerProps {
  integrationId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Choose which of a connection's devices appear on the dashboard, with Hearth's suggestions ticked to start. */
export function DevicePicker({ integrationId, onOpenChange, onSaved }: DevicePickerProps) {
  return (
    <Dialog open={Boolean(integrationId)} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title="Choose what to show" description="Pick the devices you want on your dashboard. Settings and diagnostic entries start unticked. You can change this any time in Settings.">
        {integrationId && <PickerBody key={integrationId} integrationId={integrationId} onSaved={() => { onSaved(); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ integrationId, onSaved }: { integrationId: string; onSaved: () => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/integrations/${integrationId}/review`, { cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not list the devices.");
        return body as Review;
      })
      .then(body => {
        if (cancelled) return;
        setReview(body);
        setSelected(new Set(body.shown));
      }, cause => !cancelled && setLoadError(cause instanceof Error ? cause.message : "Could not list the devices."));
    return () => { cancelled = true; };
  }, [integrationId]);

  const fresh = useMemo(() => new Set(review?.fresh ?? []), [review]);
  const visible = useMemo(() => {
    if (!review) return [];
    const kinds = GROUPS.find(item => item.value === group)?.kinds ?? [];
    const needle = query.trim().toLowerCase();
    return review.devices.filter(device =>
      (kinds.length === 0 || (kinds as readonly string[]).includes(device.kind))
      && (!needle || `${device.name} ${device.room ?? ""} ${kindLabel(device)}`.toLowerCase().includes(needle)));
  }, [review, group, query]);

  const rooms = useMemo(() => {
    const byRoom = new Map<string, Device[]>();
    for (const device of visible) byRoom.set(device.room ?? "No room", [...(byRoom.get(device.room ?? "No room") ?? []), device]);
    return [...byRoom.entries()]
      .sort(([a], [b]) => a === "No room" ? 1 : b === "No room" ? -1 : a.localeCompare(b))
      .map(([room, devices]) => [room, devices.sort((a, b) => Number(Boolean(a.auxiliary)) - Number(Boolean(b.auxiliary)) || a.name.localeCompare(b.name))] as const);
  }, [visible]);

  if (loadError) return <Alert tone="danger" title="Could not list the devices">{loadError}</Alert>;
  if (!review) return <div className={styles.loading} aria-busy="true"><Skeleton lines={5} label="Finding your devices" /></div>;

  const set = (ids: string[], on: boolean) => setSelected(current => {
    const next = new Set(current);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    return next;
  });
  const unsupported = Object.entries(review.unsupported).sort((a, b) => b[1] - a[1]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    const result = await chooseDevices(integrationId, [...(selected)]);
    setSaving(false);
    if (!result.ok) return setSaveError(result.error);
    onSaved();
  }

  return (
    <div className={styles.body}>
      <p className={styles.lede}>{review.name} has {review.devices.length} {review.devices.length === 1 ? "device" : "devices"} Hearth can show{fresh.size ? `, ${fresh.size} of them new since you last chose` : ""}.</p>
      <div className={styles.toolbar}>
        <SearchField label="Search" value={query} onValueChange={setQuery} placeholder="Name, room, or type" />
        <Select label="Type" value={group} onValueChange={setGroup} options={GROUPS.map(item => ({ value: item.value, label: item.label }))} />
      </div>
      <div className={styles.bulk}>
        <span className={styles.count} aria-live="polite">{selected.size} selected</span>
        <div className={styles.bulkActions}>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(review.recommended))}>Recommended</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => set(visible.map(device => device.id), true)}>Select all</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => set(visible.map(device => device.id), false)}>Clear</Button>
        </div>
      </div>

      <div className={styles.list}>
        {rooms.length === 0 && <p className={styles.empty}>Nothing matches that search.</p>}
        {rooms.map(([room, devices]) => {
          const ids = devices.map(device => device.id);
          const chosen = ids.filter(id => selected.has(id)).length;
          return (
            <section key={room} className={styles.room} aria-label={room}>
              <div className={styles.roomHeader}>
                <Checkbox
                  label={`${room} (${devices.length})`}
                  checked={chosen === 0 ? false : chosen === ids.length ? true : "indeterminate"}
                  onCheckedChange={value => set(ids, value === true)}
                />
              </div>
              {devices.map(device => {
                const style = defaultStyle(device);
                const Icon = TILE_ICON_COMPONENTS[style.icon];
                const checked = selected.has(device.id);
                return (
                  <div key={device.id} className={styles.row} data-checked={checked || undefined} data-auxiliary={device.auxiliary || undefined} onClick={() => set([device.id], !checked)}>
                    <span className={styles.icon} data-color={style.color} aria-hidden="true"><Icon size={18} strokeWidth={1.75} /></span>
                    <span className={styles.text}>
                      <span className={styles.name}>{device.name}</span>
                      <span className={styles.meta}>{kindLabel(device)} · {statusText(device)}</span>
                    </span>
                    <span className={styles.tags}>
                      {fresh.has(device.id) && <Badge tone="info" size="sm">New</Badge>}
                      {device.auxiliary && <Badge size="sm">Settings or diagnostics</Badge>}
                      {!device.available && <Badge tone="warning" size="sm">Unavailable</Badge>}
                    </span>
                    <span onClick={event => event.stopPropagation()}>
                      <Checkbox aria-label={`Show ${device.name}`} checked={checked} onCheckedChange={value => set([device.id], value === true)} />
                    </span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>

      {unsupported.length > 0 && (
        <p className={styles.note}>Hearth cannot show these yet, so they are left out: {unsupported.map(([type, count]) => `${type.replaceAll("_", " ")} ${count}`).join(" · ")}.</p>
      )}
      <Alert tone="danger" title="Could not save your choice" open={Boolean(saveError)}>{saveError ?? ""}</Alert>
      <div className={styles.actions}>
        <DialogClose asChild><Button type="button" variant="ghost">Not now</Button></DialogClose>
        <Button type="button" loading={saving} onClick={save}>{selected.size === 0 ? "Show nothing" : `Show ${selected.size} ${selected.size === 1 ? "device" : "devices"}`}</Button>
      </div>
    </div>
  );
}
