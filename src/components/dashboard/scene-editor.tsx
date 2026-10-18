"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { SearchField } from "@/components/arc/search-field/search-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { glassSheetClass } from "@/components/glass/glass";
import { createScene, updateScene } from "@/lib/actions";
import type { TileIcon } from "@/lib/dashboard/layout";
import { defaultStyle } from "@/lib/dashboard/style";
import type { Device, DeviceCommand } from "@/lib/devices/types";
import { captureState, sceneable, type HearthScene } from "@/lib/scenes/types";
import { TILE_ICON_COMPONENTS, iconLabel } from "./tiles/tile-icons";
import styles from "./scene-editor.module.css";

const SCENE_ICONS: TileIcon[] = ["clapperboard", "moon", "sun", "sparkles", "house", "tv", "bed", "coffee", "music", "star", "shield", "lock"];
const ENTRY_COVERS = new Set(["garage", "door", "gate"]);

interface SceneEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: Device[];
  /** The scene to edit, or null to make a new one. */
  scene: HearthScene | null;
  /** `created` is true for a new scene, so the dashboard can give it a tile. */
  onSaved: (id: string, created: boolean) => void;
}

export function SceneEditor({ open, onOpenChange, devices, scene, onSaved }: SceneEditorProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={scene ? `Edit ${scene.name}` : "New scene"} description="Add devices, then choose how each one should be when the scene runs.">
        {open && <SceneForm key={scene?.id ?? "new"} devices={devices} scene={scene} onSaved={(id, created) => { onSaved(id, created); onOpenChange(false); }} />}
      </DialogContent>
    </Dialog>
  );
}

function SceneForm({ devices, scene, onSaved }: { devices: Device[]; scene: HearthScene | null; onSaved: (id: string, created: boolean) => void }) {
  const candidates = useMemo(() => devices.filter(sceneable), [devices]);
  const byId = useMemo(() => new Map(candidates.map(device => [device.id, device])), [candidates]);
  const [name, setName] = useState(scene?.name ?? "");
  const [icon, setIcon] = useState<TileIcon>((scene?.icon as TileIcon | null) ?? "clapperboard");
  const [chosen, setChosen] = useState<[string, DeviceCommand[]][]>(() => {
    const initial = new Map<string, DeviceCommand[]>();
    for (const action of scene?.actions ?? []) initial.set(action.deviceId, [...(initial.get(action.deviceId) ?? []), action.command]);
    return [...initial];
  });
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const included = new Set(chosen.map(([id]) => id));

  const rooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const groups = new Map<string, Device[]>();
    for (const device of candidates) {
      if (included.has(device.id) || (needle && !`${device.name} ${device.room ?? ""}`.toLowerCase().includes(needle))) continue;
      groups.set(device.room ?? "Other", [...(groups.get(device.room ?? "Other") ?? []), device]);
    }
    return [...groups.entries()].sort(([a], [b]) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `included` is derived from `chosen`
  }, [candidates, query, chosen]);

  const add = (device: Device) => setChosen(current => [...current, [device.id, captureState(device)]]);
  const remove = (id: string) => setChosen(current => current.filter(([item]) => item !== id));
  const change = (id: string, commands: DeviceCommand[]) => setChosen(current => current.map(entry => entry[0] === id ? [id, commands] : entry));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const input = { name, icon, actions: chosen.flatMap(([deviceId, commands]) => commands.map(command => ({ deviceId, command }))) };
    const result = scene ? await updateScene(scene.id, input) : await createScene(input);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onSaved(scene?.id ?? ("id" in result ? String(result.id) : ""), !scene);
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

      <section aria-labelledby="scene-devices" className={styles.section}>
        <h3 id="scene-devices" className={styles.heading}>{chosen.length ? `In this scene · ${chosen.length}` : "In this scene"}</h3>
        {chosen.length === 0 ? <p className={styles.empty}>Nothing yet. Add a device below, then choose what it does.</p> : (
          <ul className={styles.chosen}>
            {chosen.map(([id, commands]) => {
              const device = byId.get(id);
              if (!device) return null;
              const Icon = TILE_ICON_COMPONENTS[defaultStyle(device).icon];
              return (
                <li key={id} className={styles.item}>
                  <div className={styles.itemHead}>
                    <span className={styles.itemIcon} aria-hidden="true"><Icon size={16} strokeWidth={1.75} /></span>
                    <span className={styles.itemText}>
                      <span className={styles.itemName}>{device.name}</span>
                      {device.room && <span className={styles.itemRoom}>{device.room}</span>}
                    </span>
                    <button type="button" className={styles.remove} onClick={() => remove(id)} aria-label={`Take ${device.name} out of the scene`}>
                      <X size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                  <ActionControls device={device} commands={commands} onChange={next => change(id, next)} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Add devices" className={styles.section}>
        <SearchField label="Add devices" value={query} onValueChange={setQuery} placeholder="Lamp, kitchen, fan" />
        {rooms.length === 0 ? <p className={styles.empty}>{query ? "Nothing matches that." : "Every device is in the scene."}</p> : rooms.map(([room, items]) => (
          <div key={room} className={styles.room}>
            <h4 className={styles.roomName}>{room}</h4>
            <ul className={styles.options}>
              {items.map(device => (
                <li key={device.id}>
                  <button type="button" className={styles.option} onClick={() => add(device)} aria-label={`Add ${device.name}${device.room ? ` in ${device.room}` : ""}`}>
                    <span className={styles.optionName}>{device.name}</span>
                    <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <Alert tone="danger" title="Could not save the scene" open={Boolean(error)}>{error ?? ""}</Alert>
      <div className={styles.actions}>
        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
        <Button type="submit" loading={pending} disabled={chosen.length === 0 || !name.trim()}>{scene ? "Save scene" : "Create scene"}</Button>
      </div>
    </form>
  );
}

const find = <T extends DeviceCommand["type"]>(commands: DeviceCommand[], type: T) => commands.find((command): command is Extract<DeviceCommand, { type: T }> => command.type === type);
const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1).replace(/_/g, " ");

/** How one device is set when the scene runs. Locks always lock and doors always close, so a scene never opens the home. */
function ActionControls({ device, commands, onChange }: { device: Device; commands: DeviceCommand[]; onChange: (commands: DeviceCommand[]) => void }) {
  const onOff = (on: boolean, level: (on: boolean) => DeviceCommand[]) => (
    <SegmentedControl label={`${device.name} in this scene`} value={on ? "on" : "off"} onValueChange={value => onChange(level(value === "on"))} options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]} />
  );
  switch (device.kind) {
    case "light": {
      const on = !commands.some(command => command.type === "power" && !command.on);
      const brightness = find(commands, "brightness")?.value ?? (device.brightness || 100);
      const shade = commands.filter(command => command.type === "color" || command.type === "temperature");
      const build = (next: boolean, value = brightness): DeviceCommand[] => !next ? [{ type: "power", on: false }] : [...shade, device.dimmable ? { type: "brightness", value } : { type: "power", on: true }];
      return (
        <div className={styles.controls}>
          {onOff(on, next => build(next))}
          {on && device.dimmable && <Slider label="Brightness" value={brightness} min={1} max={100} format={value => `${value}%`} onValueChange={value => onChange(build(true, value))} />}
        </div>
      );
    }
    case "fan": {
      const on = !commands.some(command => command.type === "power" && !command.on);
      const speed = find(commands, "fanSpeed")?.value ?? (device.speed || 50);
      const build = (next: boolean, value = speed): DeviceCommand[] => !next ? [{ type: "power", on: false }] : device.adjustable ? [{ type: "fanSpeed", value }] : [{ type: "power", on: true }];
      return (
        <div className={styles.controls}>
          {onOff(on, next => build(next))}
          {on && device.adjustable && <Slider label="Speed" value={speed} min={1} max={100} format={value => `${value}%`} onValueChange={value => onChange(build(true, value))} />}
        </div>
      );
    }
    case "switch":
      return <div className={styles.controls}>{onOff(find(commands, "power")?.on ?? false, next => [{ type: "power", on: next }])}</div>;
    case "thermostat": {
      const mode = find(commands, "thermostatMode")?.mode ?? device.mode;
      const target = find(commands, "targetTemperature")?.value ?? device.target ?? device.min;
      const build = (next = mode, value = target): DeviceCommand[] => next === "off" ? [{ type: "thermostatMode", mode: "off" }] : [{ type: "thermostatMode", mode: next }, { type: "targetTemperature", value }];
      return (
        <div className={styles.controls}>
          <SegmentedControl label={`${device.name} mode`} value={mode} onValueChange={value => onChange(build(value as typeof mode))} options={device.modes.map(value => ({ value, label: capitalize(value) }))} />
          {mode !== "off" && <Slider label="Temperature" value={target} min={device.min} max={device.max} step={device.step} format={value => `${value}°${device.unit}`} onValueChange={value => onChange(build(mode, value))} />}
        </div>
      );
    }
    case "lock":
      return <p className={styles.fixed}>Locks. A scene can lock, but never unlock.</p>;
    case "cover": {
      if (ENTRY_COVERS.has(device.coverClass)) return <p className={styles.fixed}>Closes. A scene can close it, but never open it.</p>;
      if (device.canSetPosition) {
        const position = find(commands, "coverPosition")?.value ?? (find(commands, "cover")?.action === "open" ? 100 : 0);
        return <div className={styles.controls}><Slider label="Open" value={position} min={0} max={100} step={5} format={value => value === 0 ? "Closed" : `${value}%`} onValueChange={value => onChange([{ type: "coverPosition", value }])} /></div>;
      }
      const open = find(commands, "cover")?.action === "open";
      return (
        <div className={styles.controls}>
          <SegmentedControl label={`${device.name} in this scene`} value={open ? "open" : "close"} onValueChange={value => onChange([{ type: "cover", action: value === "open" ? "open" : "close" }])} options={[{ value: "open", label: "Open" }, { value: "close", label: "Close" }]} />
        </div>
      );
    }
    default:
      return null;
  }
}
