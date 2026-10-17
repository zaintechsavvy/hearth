"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CalendarDays, Clapperboard, DoorOpen, House, LayoutGrid, Lightbulb, Lock, Moon, Music, Palette, Plug, Plus, Search, Settings, Sparkles, Sun, Timer, type LucideIcon, Warehouse, Wind } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CommandPalette, type CommandItem } from "@/components/arc/command-palette/command-palette";
import { askHearth } from "@/components/assistant/assistant-dock";
import { useHome } from "@/components/dashboard/use-home";
import { useResolvedTheme } from "@/components/shell/use-resolved-theme";
import { startBedtime } from "@/components/shell/bedtime-check";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { useThemePreference } from "@/components/shell/use-theme-preference";
import { HOME_PAGE_ID } from "@/lib/dashboard/layout";
import { isSensitive, type Device, type DeviceCommand } from "@/lib/devices/types";
import { quickTimer } from "@/lib/widgets/schedules";
import styles from "./command-menu.module.css";

/** Asks the dashboard to open its add-a-tile gallery. */
export const ADD_TILE_EVENT = "hearth-add-tile";
const OPEN_EVENT = "hearth-command-menu";
export const openCommandMenu = () => window.dispatchEvent(new Event(OPEN_EVENT));

const KIND_ICONS: Partial<Record<Device["kind"], LucideIcon>> = { light: Lightbulb, switch: Plug, fan: Wind, lock: Lock, cover: Warehouse, scene: Clapperboard, media_player: Music };
const SETTINGS = [
  { id: "connections", label: "Connections" }, { id: "rooms", label: "Rooms" }, { id: "cameras", label: "Cameras" },
  { id: "calendars", label: "Calendars" }, { id: "alerts", label: "Alerts" }, { id: "appearance", label: "Appearance" }, { id: "assistants", label: "Assistants" },
];

let menuOpen = false;
const listeners = new Set<() => void>();
const setMenuOpen = (open: boolean) => {
  menuOpen = open;
  for (const listener of listeners) listener();
};

/** One search for everything: switch a device, run a scene, jump to a page or a setting, start a timer, or ask Hearth. */
export function CommandMenu({ limited = false }: { limited?: boolean }) {
  const open = useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => menuOpen, () => false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setMenuOpen(!menuOpen);
      }
    };
    const onOpen = () => setMenuOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setMenuOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.overlay} />
        <DialogPrimitive.Content className={styles.content} aria-describedby={undefined}>
          <DialogPrimitive.Title className={styles.hidden}>Search Hearth</DialogPrimitive.Title>
          {open && <Menu limited={limited} close={() => setMenuOpen(false)} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function deviceCommand(device: Device): { label: string; command: DeviceCommand } | null {
  if (!device.available) return null;
  switch (device.kind) {
    case "light":
    case "switch":
    case "fan":
      return { label: `Turn ${device.on ? "off" : "on"} ${device.name}`, command: { type: "power", on: !device.on } };
    case "lock":
      return device.state === "locked" ? null : { label: `Lock ${device.name}`, command: { type: "lock", locked: true } };
    case "cover":
      return device.state === "closed" ? null : { label: `Close ${device.name}`, command: { type: "cover", action: "close" } };
    case "scene":
      return { label: `Run ${device.name}`, command: { type: "activate" } };
    case "vacuum":
      return device.state === "cleaning" ? { label: `Send ${device.name} home`, command: { type: "vacuum", action: "dock" } } : { label: `Start ${device.name}`, command: { type: "vacuum", action: "start" } };
    case "alarm":
      return device.state === "disarmed" && device.modes.includes("away") && !device.codeToArm ? { label: `Arm ${device.name}, away`, command: { type: "alarm", action: "arm", mode: "away" } } : null;
    case "media_player":
      if (device.state === "off") return null;
      return device.state === "playing" ? { label: `Pause ${device.name}`, command: { type: "media", action: "pause" } } : { label: `Play ${device.name}`, command: { type: "media", action: "play" } };
    default:
      return null;
  }
}

/** Guests get their devices, scenes, and pages; nothing that changes the home's setup. */
function Menu({ close, limited }: { close: () => void; limited: boolean }) {
  const router = useRouter();
  const { home, send, runScene, saveItem } = useHome();
  const [, setPage] = useStoredJson<string>("hearth-page", HOME_PAGE_ID);
  const [, setTheme] = useThemePreference();
  const theme = useResolvedTheme();
  const [error, setError] = useState<string | null>(null);
  const handlers = new Map<string, () => unknown>();
  const items: CommandItem[] = [];
  const add = (item: CommandItem, run: () => unknown) => {
    items.push(item);
    handlers.set(item.id, run);
  };
  const icon = (Icon: LucideIcon) => <Icon size={16} strokeWidth={1.75} aria-hidden="true" />;

  if (!limited) add({ id: "ask", label: "Ask Hearth", description: "Type or say what you want", group: "Assistant", keywords: ["assistant", "ai", "help"], icon: icon(Sparkles), shortcut: "⌘J" }, () => askHearth());
  for (const device of home?.devices ?? []) {
    const action = deviceCommand(device);
    if (!action || isSensitive(device, action.command)) continue;
    add({ id: `device:${device.id}`, label: action.label, description: device.room ?? undefined, group: "Devices", keywords: [device.name, device.room ?? "", device.kind], icon: icon(KIND_ICONS[device.kind] ?? Lightbulb) }, () => send(device, action.command));
  }
  for (const scene of home?.scenes ?? []) {
    add({ id: `scene:${scene.id}`, label: `Run ${scene.name}`, description: `${scene.actions.length} steps`, group: "Scenes", keywords: ["scene", scene.name], icon: icon(Clapperboard) }, () => runScene(scene));
  }
  for (const page of home?.pages ?? []) {
    add({ id: `page:${page.id}`, label: `Go to ${page.name}`, group: "Pages", keywords: ["page", "dashboard", page.name], icon: icon(LayoutGrid) }, () => { setPage(page.id); router.push("/dashboard"); });
  }
  if (!limited) {
    for (const minutes of [5, 10, 15, 30]) {
      add({ id: `timer:${minutes}`, label: `Start a ${minutes} minute timer`, group: "Timers", keywords: ["timer", "kitchen", "countdown"], icon: icon(Timer) }, () => saveItem("timer", quickTimer(minutes)));
    }
    add({ id: "bedtime", label: "Good night", group: "Home", keywords: ["night", "lock up", "good night", "bed"], icon: icon(Moon) }, () => startBedtime());
    add({ id: "add-tile", label: "Add a tile", group: "Dashboard", keywords: ["new", "widget", "tile"], icon: icon(Plus) }, () => { router.push("/dashboard"); setTimeout(() => window.dispatchEvent(new Event(ADD_TILE_EVENT)), 150); });
    add({ id: "studio", label: "Change the background", group: "Dashboard", keywords: ["wallpaper", "gradient", "photo", "theme"], icon: icon(Palette) }, () => router.push("/settings#appearance"));
    add({ id: "theme", label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode", group: "Dashboard", keywords: ["theme", "dark", "light", "night"], icon: icon(theme === "dark" ? Sun : Moon) }, () => setTheme(theme === "dark" ? "light" : "dark"));
    add({ id: "wall", label: "Wall tablet settings", group: "Go to", keywords: ["kiosk", "tablet", "screensaver", "dim"], icon: icon(Settings) }, () => router.push("/settings#wall"));
    add({ id: "automations", label: "Automations", description: "Rules that run on their own", group: "Go to", keywords: ["rules", "schedule", "routine", "sunset"], icon: icon(Sparkles) }, () => router.push("/automations"));
    add({ id: "activity", label: "Activity", description: "What happened at home", group: "Go to", keywords: ["history", "log", "timeline"], icon: icon(House) }, () => router.push("/activity"));
    add({ id: "home", label: "Go home", group: "Go to", keywords: ["dashboard"], icon: icon(House) }, () => router.push("/dashboard"));
    for (const section of SETTINGS) {
      add({ id: `settings:${section.id}`, label: `Settings: ${section.label}`, group: "Go to", keywords: ["settings", section.label], icon: icon(section.id === "rooms" ? DoorOpen : section.id === "calendars" ? CalendarDays : Settings) }, () => router.push(`/settings#${section.id}`));
    }
  }
  return (
    <div className={styles.menu}>
      <CommandPalette
        autoFocus
        label="Search Hearth"
        placeholder="Search devices, scenes, pages, and settings"
        items={items}
        onClose={close}
        onSelect={async item => {
          close();
          try {
            await handlers.get(item.id)?.();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "That did not work.");
          }
        }}
      />
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}

/** The header's search button, for anyone who does not know the shortcut. */
export function CommandMenuButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openCommandMenu} aria-label="Search" aria-keyshortcuts="Meta+K Control+K" title="Search (⌘K)">
      <Search size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
