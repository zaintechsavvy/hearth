"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { Switch } from "@/components/arc/switch/switch";
import { glassSheetClass } from "@/components/glass/glass";
import { createScene, updateScene } from "@/lib/actions";
import type { TileIcon } from "@/lib/dashboard/layout";
import type { Device, DeviceCommand } from "@/lib/devices/types";
import { captureState, describeAction, sceneable, type HearthScene } from "@/lib/scenes/types";
import { TILE_ICON_COMPONENTS, iconLabel } from "./tiles/tile-icons";
import styles from "./scene-editor.module.css";

const SCENE_ICONS: TileIcon[] = ["clapperboard", "moon", "sun", "sparkles", "house", "tv", "bed", "coffee", "music", "star", "shield", "lock"];

interface SceneEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: Device[];
  /** The scene to edit, or null to make a new one. */
  scene: HearthScene | null;
  onSaved: () => void;
}

export function SceneEditor({ open, onOpenChange, devices, scene, onSaved }: SceneEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={scene ? `Edit ${scene.name}` : "New scene"} description="Set your devices the way you want them, then choose which ones the scene includes.">
        {open && <SceneForm key={scene?.id ?? "new"} devices={devices} scene={scene} onSaved={() => { onSaved(); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}

function SceneForm({ devices, scene, onSaved }: { devices: Device[]; scene: HearthScene | null; onSaved: () => void }) {
  const candidates = useMemo(() => devices.filter(sceneable), [devices]);
  const [name, setName] = useState(scene?.name ?? "");
  const [icon, setIcon] = useState<TileIcon>((scene?.icon as TileIcon | null) ?? "clapperboard");
  const [chosen, setChosen] = useState<Map<string, DeviceCommand[]>>(() => {
    const initial = new Map<string, DeviceCommand[]>();
    for (const action of scene?.actions ?? []) initial.set(action.deviceId, [...(initial.get(action.deviceId) ?? []), action.command]);
    return initial;
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rooms = useMemo(() => {
    const groups = new Map<string, Device[]>();
    for (const device of candidates) groups.set(device.room ?? "Other", [...(groups.get(device.room ?? "Other") ?? []), device]);
    return [...groups.entries()].sort(([a], [b]) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b));
  }, [candidates]);

  const toggle = (device: Device, include: boolean) => setChosen(current => {
    const next = new Map(current);
    if (include) next.set(device.id, captureState(device));
    else next.delete(device.id);
    return next;
  });

  const recapture = () => setChosen(current => new Map([...current.keys()].flatMap(id => {
    const device = candidates.find(item => item.id === id);
    return device ? [[id, captureState(device)] as const] : [];
  })));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const input = { name, icon, actions: [...chosen.entries()].flatMap(([deviceId, commands]) => commands.map(command => ({ deviceId, command }))) };
    const result = scene ? await updateScene(scene.id, input) : await createScene(input);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Input label="Name" value={name} onChange={event => setName(event.target.value)} placeholder="Movie night" required autoComplete="off" />
      <div role="radiogroup" aria-label="Icon" className={styles.icons}>
        {SCENE_ICONS.map(option => {
          const Icon = TILE_ICON_COMPONENTS[option];
          return (
            <button key={option} type="button" role="radio" aria-checked={icon === option} aria-label={iconLabel(option)} className={styles.icon} onClick={() => setIcon(option)}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className={styles.listHeader}>
        <span className={styles.count}>{chosen.size} {chosen.size === 1 ? "device" : "devices"}</span>
        <Button type="button" variant="ghost" size="sm" onClick={recapture} disabled={chosen.size === 0}>Use current state</Button>
      </div>
      <div className={styles.list}>
        {rooms.map(([room, items]) => (
          <section key={room} aria-label={room} className={styles.room}>
            <h3 className={styles.roomName}>{room}</h3>
            {items.map(device => {
              const commands = chosen.get(device.id);
              return (
                <div key={device.id} className={styles.row}>
                  <span id={`scene-${device.id}`} className={styles.rowText}>
                    <span className={styles.rowName}>{device.name}</span>
                    <span className={styles.rowState}>{(commands ?? captureState(device)).map(command => describeAction(device, command)).join(" · ")}</span>
                  </span>
                  <Switch aria-labelledby={`scene-${device.id}`} checked={Boolean(commands)} onCheckedChange={include => toggle(device, include)} />
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <Alert tone="danger" title="Could not save the scene" open={Boolean(error)}>{error ?? ""}</Alert>
      <div className={styles.actions}>
        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
        <Button type="submit" loading={pending} disabled={chosen.size === 0}>{scene ? "Save scene" : "Create scene"}</Button>
      </div>
    </form>
  );
}
