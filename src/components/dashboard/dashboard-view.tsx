"use client";

import { Clapperboard, ClipboardPaste, Compass, Copy, House, LayoutGrid, ListChecks, Plus, QrCode, Sparkles, Sun, Trash2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { DropdownMenu } from "@/components/arc/dropdown-menu/dropdown-menu";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Glass, glassClass } from "@/components/glass/glass";
import { addDemoHome, deleteScene, saveLayout, updateDevice } from "@/lib/actions";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { useTick } from "./household/use-tick";
import { ADD_TILE_EVENT } from "@/components/shell/command-menu";
import type { HomeCamera } from "@/lib/home";
import { INTEGRATION_LABELS } from "@/lib/integrations/types";
import { KIND_INFO } from "@/lib/dashboard/catalog";
import {
  cameraTileId, createTile, defaultSize, HOME_PAGE_ID, isStyled, isWidget, newTileId, removeTile, resolveLayout, SIZE_OPTIONS, spanOf, updateTile,
  type TileConfig, type TileKind, type TileSource,
} from "@/lib/dashboard/layout";
import { cameraLayoutTiles } from "@/lib/dashboard/camera-pages";
import { arrange } from "@/lib/dashboard/placement";
import { hasLevel, tileSources } from "@/lib/dashboard/sources";
import { defaultStyle } from "@/lib/dashboard/style";
import { kindLabel, statusText } from "@/lib/devices/status";
import { isSwitchableKind, type Device, type DeviceKind, type ThermostatDevice } from "@/lib/devices/types";
import { sceneTileId, type HearthScene } from "@/lib/scenes/types";
import { CameraTile } from "./camera-tile";
import type { Candidate } from "./entity-chooser";
import { HomeGrid } from "./home-grid";
import { IntegrationCameraTile } from "./integration-camera-tile";
import { SnapshotCamera } from "./camera-snapshots";
import { CameraSheet } from "./camera-sheet";
import { hasControls, LightControls } from "./light-controls";
import { HistorySheet } from "./history-sheet";
import { SceneEditor } from "./scene-editor";
import { Thermostat, formatTemperature } from "./thermostat";
import { TileDialog, type TileDialogMode } from "./tile-dialog";
import { TileEditor, type EditableTile } from "./tile-editor";
import { DeviceTile } from "./tiles/device-tile";
import { AlarmTile } from "./devices/alarm-tile";
import { AnnounceTile } from "./glance/announce-tile";
import { AppliancesTile } from "./glance/appliances-tile";
import { EnergyTile } from "./glance/energy-tile";
import { ActivityTile } from "./glance/activity-tile";
import { PeopleTile } from "./glance/people-tile";
import { ChartTile } from "./devices/chart-tile";
import { LeakTile } from "./devices/leak-tile";
import { PersonTile } from "./devices/person-tile";
import { TodoTile } from "./devices/todo-tile";
import { VacuumTile } from "./devices/vacuum-tile";
import { MediaTile } from "./media/media-tile";
import { useMinute } from "./widgets/use-minute";
import { activeRule, NO_PAGE_RULES, PAGE_SCHEDULE_KEY, type PageRule } from "@/lib/page-schedule";
import { PlaceholderTile } from "./tiles/placeholder-tile";
import { SceneTile } from "./tiles/scene-tile";
import { useHome } from "./use-home";
import { CalendarTile } from "./widgets/calendar-tile";
import { ClockTile } from "./widgets/clock-tile";
import { RemindersTile } from "./widgets/reminders-tile";
import { WeatherTile } from "./widgets/weather-tile";
import { BinsTile } from "./household/bins-tile";
import { CountdownTile } from "./household/countdown-tile";
import { MedicationsTile } from "./household/medications-tile";
import { NotesTile } from "./household/notes-tile";
import { PlantsTile } from "./household/plants-tile";
import { PackagesTile } from "./household/packages-tile";
import { TimersTile } from "./household/timers-tile";
import { WidgetEditor, isHousehold, ITEM_KIND_FOR, type WidgetEditorState } from "./household/widget-editor";
import { WifiShare } from "./household/wifi-share";
import { DeparturesTile } from "./transit/departures-tile";
import { StopsDialog } from "./transit/stops-dialog";
import { WifiTile } from "./household/wifi-tile";
import { itemsOf } from "@/lib/widgets/items";
import { publishWallRooms, subscribeWallRooms, takeWantedRoom, wallRooms } from "@/lib/wall-rooms";
import styles from "./dashboard.module.css";

const SAVE_DELAY_MS = 500;
const PAGE_KEY = "hearth-page";
const SWIPE_PX = 70;
const DEFAULT_SNAPSHOT_SECONDS = 30;
const CLIPBOARD_KEY = "hearth-tile-clipboard";
const NO_TILES: TileConfig[] = [];
/** What a camera's advanced view can put under the picture: things you work while looking. */
const CONTROL_KINDS = new Set<Device["kind"]>(["lock", "cover", "light", "switch", "fan", "alarm"]);
const ALL_ROOMS = "all";
const LEVEL_SIZES = new Set(["1x2", "2x2"]);
const subscribeNever = () => () => {};

/** Devices that can stand in for a tile type: a chandelier on a smart switch is still a light to the person adding it. */
const COMPATIBLE: Partial<Record<TileKind, DeviceKind[]>> = {
  light: ["light", "switch"],
  switch: ["switch", "light"],
  fan: ["fan", "switch"],
  event: ["event", "binary_sensor"],
  leak: ["binary_sensor"],
};

type Linked =
  | { type: "device"; device: Device }
  | { type: "camera"; camera: HomeCamera }
  | { type: "scene"; scene: HearthScene };

/** The wall tablet is shared by the household, so it drops the name and keeps only the greeting. */
function Greeting({ hour, name }: { hour: number | null; name: string }) {
  const words = hour === null ? "Welcome home" : hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return <>{words}<span data-wall-hide>, {name.split(" ")[0]}</span></>;
}

/** Tells the wall tablet's menu which rooms there are, and switches to the one it asks for. */
function WallRoomsBridge({ rooms, current, onWant }: { rooms: string[]; current: string; onWant: (room: string) => void }) {
  useEffect(() => publishWallRooms(rooms, current), [rooms, current]);
  const wanted = useSyncExternalStore(subscribeWallRooms, () => wallRooms().wanted, () => null);
  useEffect(() => {
    if (wanted === null) return;
    const room = takeWantedRoom();
    if (room !== null) onWant(room || ALL_ROOMS);
  }, [wanted, onWant]);
  return null;
}

function summarize(devices: Device[]) {
  const lights = devices.filter(device => device.kind === "light" && device.on).length;
  const thermostat = devices.find((device): device is ThermostatDevice => device.kind === "thermostat" && device.current !== null);
  const parts = [lights === 0 ? "All lights off" : `${lights} ${lights === 1 ? "light" : "lights"} on`];
  if (thermostat?.current != null) parts.push(`${formatTemperature(thermostat.current)}° inside`);
  return parts.join(" · ");
}

export function DashboardView({ userName, canEdit = true }: { userName: string; canEdit?: boolean }) {
  const { home, error, isLoading, live, refresh, send, runScene } = useHome();
  const [sceneEditing, setSceneEditing] = useState<HearthScene | "new" | null>(null);
  const hour = useSyncExternalStore(subscribeNever, () => new Date().getHours(), () => null);
  const minute = useTick(60_000);
  const today = minute ? new Date(minute).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TileConfig[] | null>(null);
  const [customizing, setCustomizing] = useState<string | null>(null);
  const [dialog, setDialog] = useState<TileDialogMode | null>(null);
  const [controlling, setControlling] = useState<string | null>(null);
  const [managing, setManaging] = useState<WidgetEditorState | null>(null);
  const [charting, setCharting] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null | undefined>(undefined);
  const [stopsFor, setStopsFor] = useState<string | null>(null);
  const [room, setRoom] = useState(ALL_ROOMS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<TileConfig[] | null>(null);
  const editingRef = useRef(false);

  const devices = useMemo(() => new Map((home?.devices ?? []).map(device => [device.id, device])), [home?.devices]);
  const cameras = useMemo(() => new Map((home?.cameras ?? []).map(camera => [cameraTileId(camera.id), camera])), [home?.cameras]);
  /** Every camera a lock, garage door, or door tile can be linked to: Home Assistant's and Hearth's own. */
  const cameraChoices = useMemo(() => [
    ...(home?.devices ?? []).filter(device => device.kind === "camera" && device.streamable).map(device => ({ value: device.id, name: device.name })),
    ...(home?.cameras ?? []).map(camera => ({ value: cameraTileId(camera.id), name: camera.name })),
  ], [home?.devices, home?.cameras]);
  const [viewing, setViewing] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  /** Tiles copied in select mode, kept on this device so they can be pasted on any page. */
  const [clipboard, setClipboard] = useStoredJson<TileConfig[]>(CLIPBOARD_KEY, NO_TILES);
  const [focus, setFocus] = useState<string | null>(null);
  const scenes = useMemo(() => new Map((home?.scenes ?? []).map(scene => [sceneTileId(scene.id), scene])), [home?.scenes]);
  const sources = useMemo<TileSource[]>(() => home ? tileSources(home) : [], [home]);
  const sourceById = useMemo(() => new Map(sources.map(source => [source.id, source])), [sources]);
  const [storedPage, setStoredPage] = useStoredJson<string>(PAGE_KEY, HOME_PAGE_ID);
  const [pageRules] = useStoredJson<PageRule[]>(PAGE_SCHEDULE_KEY, NO_PAGE_RULES);
  const minuteNow = useMinute();
  const autoRule = useRef<string | null>(null);
  // A time-of-day page takes over when its window starts and hands back to Home when it ends, so a page picked by hand in between stays put.
  const ruleNow = minuteNow === null || !home ? null : activeRule(pageRules, home.pages.map(item => item.id), new Date(minuteNow));
  const ruleId = ruleNow?.id ?? null, rulePage = ruleNow?.pageId ?? null;
  useEffect(() => {
    if (ruleId === autoRule.current) return;
    const leaving = autoRule.current !== null;
    autoRule.current = ruleId;
    if (rulePage) setStoredPage(rulePage);
    else if (leaving) setStoredPage(HOME_PAGE_ID);
  }, [ruleId, rulePage, setStoredPage]);
  // One home screen: rooms filter it, and any other pages saved earlier are kept but no longer shown.
  const page = home?.pages.find(item => item.id === HOME_PAGE_ID) ?? home?.pages[0];
  const pageId = page?.id ?? HOME_PAGE_ID;
  const tiles = useMemo(() => resolveLayout(draft ?? page?.layout ?? [], sources), [draft, page?.layout, sources]);
  const swipe = useRef<{ id: number; x: number; y: number; lastX: number; lastY: number } | null>(null);
  const gridWrap = useRef<HTMLDivElement>(null);
  const swiped = useRef(0);

  useEffect(() => () => clearTimeout(saveTimer.current), []);
  // A camera button that opens a page brings that camera's tile into view on it, with a brief ring around it.
  useEffect(() => {
    if (!focus) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      setFocus(null);
      const cell = document.querySelector<HTMLElement>(`[data-link="${CSS.escape(focus)}"]`);
      if (!cell) return;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      cell.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      if (!reduce) cell.animate([{ transform: "scale(1)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 600, easing: "cubic-bezier(.2, .8, .2, 1)", delay: 250 });
    }));
    return () => cancelAnimationFrame(frame);
  }, [focus, storedPage]);
  useEffect(() => {
    const onAdd = () => setDialog({ mode: "add" });
    window.addEventListener(ADD_TILE_EVENT, onAdd);
    return () => window.removeEventListener(ADD_TILE_EVENT, onAdd);
  }, []);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  if (isLoading && !home) return <DashboardSkeleton />;
  if (error && !home) return <Alert tone="danger" title="Could not load your home">Check that Hearth is running, then reload the page.</Alert>;
  if (!home) return null;

  const integrationNames = new Map(home.integrations.map(integration => [integration.id, integration.name]));
  const resolve = (tile: TileConfig): Linked | null => {
    if (!tile.link) return null;
    const scene = scenes.get(tile.link);
    if (scene) return { type: "scene", scene };
    const camera = cameras.get(tile.link);
    if (camera) return { type: "camera", camera };
    const device = devices.get(tile.link);
    return device ? { type: "device", device } : null;
  };
  const nameOf = (tile: TileConfig) => {
    const linked = resolve(tile);
    if (linked) return linked.type === "device" ? linked.device.name : linked.type === "camera" ? linked.camera.name : linked.scene.name;
    return tile.label ?? KIND_INFO[tile.kind].label;
  };

  const change = (next: TileConfig[]) => {
    setDraft(next);
    latest.current = next;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveLayout(next, pageId);
      if (editingRef.current || latest.current !== next) return;
      await refresh();
      if (!editingRef.current && latest.current === next) setDraft(null);
    }, SAVE_DELAY_MS);
  };

  const selectPage = (id: string) => {
    if (id === pageId) return;
    clearTimeout(saveTimer.current);
    if (draft) void saveLayout(draft, pageId);
    setDraft(null);
    latest.current = null;
    setRoom(ALL_ROOMS);
    setStoredPage(id);
  };
  /** Copied tiles land after the page's own, filling the first gaps, each as a new tile with the same settings. */
  const paste = () => {
    change([...tiles, ...clipboard.map(tile => ({ ...tile, id: newTileId(), at: undefined }))]);
  };
  /** A linked camera's button: the camera itself in a sheet, or the page chosen for it, scrolled to that camera. */
  const openCamera = (cameraId: string, opens: string | undefined) => {
    const target = opens?.startsWith("page:") ? home.pages.find(item => item.id === opens.slice(5)) : undefined;
    if (!target) return setViewing(cameraId);
    setRoom(ALL_ROOMS);
    selectPage(target.id);
    setFocus(cameraId);
  };

  const finishEditing = async () => {
    clearTimeout(saveTimer.current);
    setEditing(false);
    setSelected(null);
    if (draft) await saveLayout(draft, pageId);
    await refresh();
    setDraft(null);
  };

  const fitSize = (tile: TileConfig, kind: TileKind, source: TileSource | undefined) => {
    const allowed = SIZE_OPTIONS[kind].some(option => option.size === tile.size);
    const needsLevel = LEVEL_SIZES.has(tile.size) && (kind === "light" || kind === "fan");
    return allowed && !(needsLevel && !source?.adjustable) ? tile.size : defaultSize(kind, source?.adjustable);
  };

  const addTile = (kind: TileKind, link: string | null, options?: TileConfig["options"]) => {
    const source = link ? sourceById.get(link) : undefined;
    const tile = createTile(kind === "leak" ? kind : source?.kind ?? kind, link, source?.adjustable ?? false, options ? { options } : {});
    change([...tiles, tile]);
    if (kind === "departures") setStopsFor(tile.id);
    if (isHousehold(kind) && (kind === "countdown" || kind === "wifi" || (["bins", "medications", "plants", "packages", "appliances"].includes(kind) && itemsOf(home.widgets, ITEM_KIND_FOR[kind]).length === 0))) {
      setManaging({ kind, tile });
    }
  };

  const linkTile = (tileId: string, link: string) => {
    const source = sourceById.get(link);
    change(tiles.map(tile => {
      if (tile.id !== tileId) return tile;
      const kind = tile.kind === "leak" ? tile.kind : source?.kind ?? tile.kind;
      return { ...tile, kind, link, size: fitSize(tile, kind, source), label: undefined };
    }));
  };

  const candidates = (kind: TileKind): Candidate[] => {
    const placed = new Set(tiles.map(tile => tile.link));
    const kinds = COMPATIBLE[kind] ?? (isWidget(kind) ? [] : [kind as DeviceKind]);
    const list: Candidate[] = [];
    if (kind === "scene") {
      for (const [id, scene] of scenes) {
        list.push({ id, name: scene.name, room: null, detail: `${scene.actions.length} ${scene.actions.length === 1 ? "action" : "actions"}`, source: "Hearth", icon: scene.icon ?? "clapperboard", color: "violet", available: true, placed: placed.has(id) });
      }
    }
    if (kind === "camera") {
      for (const [id, camera] of cameras) list.push({ id, name: camera.name, room: null, detail: "RTSP camera", source: "Hearth", icon: "camera", color: "graphite", available: true, placed: placed.has(id) });
    }
    for (const device of home.devices) {
      if (!kinds.includes(device.kind)) continue;
      if (kind === "leak" && (device.kind !== "binary_sensor" || device.sensorClass !== "leak")) continue;
      // A doorbell can be a binary sensor in Home Assistant, but a leak, door, or motion sensor is never one.
      if (kind === "event" && device.kind === "binary_sensor" && (device.sensorClass !== "other" || !/bell|ding|chime|ring/i.test(device.name))) continue;
      const style = defaultStyle(device);
      list.push({
        id: device.id, name: device.name, room: device.room, detail: `${kindLabel(device)} · ${statusText(device)}`,
        source: integrationNames.get(device.integrationId) ?? "", icon: style.icon, color: style.color,
        auxiliary: device.auxiliary || sourceById.get(device.id)?.hidden, available: device.available, placed: placed.has(device.id),
      });
    }
    const rank = (candidate: Candidate) => (candidate.auxiliary ? 2 : 0) + ((devices.get(candidate.id)?.kind ?? kinds[0]) === kinds[0] ? 0 : 1);
    return list.sort((a, b) => rank(a) - rank(b));
  };

  const tileRooms = new Set(tiles.map(tile => {
    const linked = resolve(tile);
    return linked?.type === "device" ? linked.device.room : null;
  }));
  const linkedRooms = home.rooms.filter(value => tileRooms.has(value));
  const roomOf = (tile: TileConfig) => {
    const linked = resolve(tile);
    return linked?.type === "device" ? linked.device.room : null;
  };
  const filtering = room !== ALL_ROOMS && linkedRooms.includes(room);
  // Like Apple Home, a swipe moves through All and each room, then on to the next page, and the new screen slides in from that side.
  const screens = linkedRooms.length > 1 ? [ALL_ROOMS, ...linkedRooms] : [ALL_ROOMS];
  const current = filtering ? room : ALL_ROOMS;
  const slide = (direction: number) => {
    if (!direction || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    requestAnimationFrame(() => gridWrap.current?.animate(
      [{ transform: `translateX(${direction * 48}px)`, opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 320, easing: "cubic-bezier(.2, .8, .2, 1)" },
    ));
  };
  const showRoom = (next: string) => {
    slide(Math.sign(screens.indexOf(next) - screens.indexOf(current)));
    setRoom(next);
  };
  /** A swipe moves through the rooms. */
  const step = (direction: 1 | -1, pagesOnly: boolean) => {
    const next = pagesOnly ? undefined : screens[screens.indexOf(current) + direction];
    if (next !== undefined) showRoom(next);
  };
  // Followed from first touch to last, in the capture phase, so a swipe that starts on a tile still counts even when
  // the tile, or the switch that ticks under it on an iPhone, takes the touch over before the finger lifts.
  const finishSwipe = (event: React.PointerEvent, x: number, y: number) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = x - start.x, dy = y - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    swiped.current = event.timeStamp;
    step(dx < 0 ? 1 : -1, false);
  };
  const swipeHandlers = !editing && screens.length > 1 ? {
    onPointerDownCapture: (event: React.PointerEvent) => {
      if (event.pointerType === "touch") swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY };
    },
    onPointerMoveCapture: (event: React.PointerEvent) => {
      if (swipe.current?.id === event.pointerId) Object.assign(swipe.current, { lastX: event.clientX, lastY: event.clientY });
    },
    onPointerUpCapture: (event: React.PointerEvent) => finishSwipe(event, event.clientX, event.clientY),
    onPointerCancelCapture: (event: React.PointerEvent) => finishSwipe(event, swipe.current?.lastX ?? 0, swipe.current?.lastY ?? 0),
    // The finger lifting at the end of a swipe is not a tap on the tile under it.
    onClickCapture: (event: React.MouseEvent) => {
      if (event.timeStamp - swiped.current > 400) return;
      event.preventDefault();
      event.stopPropagation();
    },
  } : {};
  const shownTiles = filtering ? tiles.filter(tile => roomOf(tile) === room) : tiles;
  const failing = home.integrations.filter(integration => !integration.ok);
  const connected = home.integrations.length > 0 || home.cameras.length > 0;
  const customizingTile = customizing ? tiles.find(tile => tile.id === customizing) : undefined;
  const sourceLabel = (device: Device) => {
    const integration = home.integrations.find(item => item.id === device.integrationId);
    return integration ? INTEGRATION_LABELS[integration.kind] : "The integration";
  };
  const editable = customizingTile ? editableTile(customizingTile, resolve(customizingTile), nameOf(customizingTile), sourceLabel, [
    ...home.scenes.map(scene => ({ value: `scene:${scene.id}`, name: scene.name })),
    ...home.devices.filter(device => device.kind === "scene").map(device => ({ value: `device:${device.id}`, name: device.name })),
  ], home.devices.filter(device => device.kind === "camera" && device.streamable).map(device => ({ value: device.id, name: device.name })), cameraChoices,
  home.pages.map(item => ({ value: item.id, name: item.name }))) : null;
  if (editable && customizingTile?.kind === "camera" && customizingTile.link) {
    const cameraId = customizingTile.link;
    const cameraRoom = devices.get(cameraId)?.room ?? null;
    const choices = home.devices.filter(device => CONTROL_KINDS.has(device.kind) && !device.auxiliary);
    const linkedHere = home.pages.flatMap(item => item.layout).flatMap(entry => "link" in entry && entry.options?.camera === cameraId && entry.link ? [entry.link] : []);
    // What you reach for while looking at a door: its lock and the garage, then the lights by it and outside.
    const ways = choices.filter(device => device.kind === "lock" || device.kind === "cover").sort((a, b) => Number(b.room === cameraRoom) - Number(a.room === cameraRoom));
    const lights = choices.filter(device => device.kind === "light" && (device.room === cameraRoom || /outside|outdoor|porch|garden|yard/i.test(device.room ?? "")));
    editable.cameraControls = {
      choices: choices.map(device => ({ value: device.id, name: [device.name, device.room].filter(Boolean).join(" · ") })),
      suggested: [...new Set([...linkedHere, ...ways.map(device => device.id), ...lights.map(device => device.id)])].slice(0, 4),
    };
  }
  const customizingLink = customizingTile ? resolve(customizingTile) : null;
  const customizingScene = customizingLink?.type === "scene" ? customizingLink.scene : null;

  /** Advanced mode: a tap on the camera opens it large, with its controls, instead of what the tile does itself. */
  const staged = (tile: TileConfig, node: ReactNode) => !tile.options?.advanced || editing ? node : (
    <div className={styles.staged} onClickCapture={event => {
      if ((event.target as Element).closest("a, [class*='__tools']")) return;
      event.preventDefault();
      event.stopPropagation();
      if (tile.link) setViewing(tile.link);
    }}>{node}</div>
  );
  const controlsFor = (cameraId: string) => {
    const tile = home.pages.flatMap(item => item.layout).find((entry): entry is TileConfig => "link" in entry && entry.link === cameraId && Boolean(entry.options?.advanced));
    return (tile?.options?.controls ?? []).flatMap(id => {
      const device = devices.get(id);
      return device ? [renderTile({ id: `stage:${id}`, kind: device.kind, link: id, size: "2x1" })] : [];
    });
  };
  const renderTile = (tile: TileConfig, preview = false) => {
    const interactive = !editing && !preview;
    switch (tile.kind) {
      case "weather":
        return <WeatherTile tile={tile} interactive={interactive} onChoosePlace={() => setDialog({ mode: "place", tile })} />;
      case "calendar":
        return <CalendarTile tile={tile} />;
      case "reminders":
        return <RemindersTile tile={tile} interactive={interactive} />;
      case "clock":
        return <ClockTile tile={tile} />;
      case "bins":
        return <BinsTile tile={tile} items={itemsOf(home.widgets, "bin")} interactive={interactive} onManage={itemId => setManaging({ kind: "bins", tile, itemId })} />;
      case "medications":
        return <MedicationsTile tile={tile} items={itemsOf(home.widgets, "medication")} interactive={interactive} onManage={itemId => setManaging({ kind: "medications", tile, itemId })} />;
      case "countdown":
        return <CountdownTile tile={tile} items={itemsOf(home.widgets, "countdown")} interactive={interactive} onManage={itemId => setManaging({ kind: "countdown", tile, itemId })} />;
      case "notes":
        return <NotesTile tile={tile} items={itemsOf(home.widgets, "note")} interactive={interactive} author={userName.split(" ")[0]} onManage={() => setManaging({ kind: "notes", tile })} />;
      case "wifi":
        return <WifiTile tile={tile} items={itemsOf(home.widgets, "wifi")} interactive={interactive} onManage={itemId => setManaging({ kind: "wifi", tile, itemId })} onShare={setSharing} />;
      case "timers":
        return <TimersTile tile={tile} items={itemsOf(home.widgets, "timer")} interactive={interactive} onManage={() => setManaging({ kind: "timers", tile })} />;
      case "plants":
        return <PlantsTile tile={tile} items={itemsOf(home.widgets, "plant")} interactive={interactive} onManage={itemId => setManaging({ kind: "plants", tile, itemId })} />;
      case "energy":
        return <EnergyTile tile={tile} devices={home.devices} />;
      case "people":
        return <PeopleTile tile={tile} devices={home.devices} now={minuteNow} />;
      case "activity":
        return <ActivityTile tile={tile} devices={home.devices} interactive={interactive} />;
      case "announce":
        return <AnnounceTile tile={tile} devices={home.devices} interactive={interactive} onOptions={patch => change(updateTile(tiles, tile.id, { options: { ...tile.options, ...patch } }))} onCommand={send} />;
      case "appliances":
        return <AppliancesTile tile={tile} items={itemsOf(home.widgets, "appliance")} devices={home.devices} now={minuteNow} interactive={interactive} onManage={() => setManaging({ kind: "appliances", tile })} />;
      case "departures":
        return <DeparturesTile tile={tile} ready={home.transitReady} sample={home.transitSample} interactive={interactive} onManage={() => setStopsFor(tile.id)} />;
      case "packages":
        return <PackagesTile tile={tile} items={itemsOf(home.widgets, "package")} interactive={interactive} onManage={itemId => setManaging({ kind: "packages", tile, itemId })} />;
    }
    const linked = resolve(tile);
    if (!linked) return <PlaceholderTile tile={tile} missing={tile.link !== null} interactive={interactive} onLink={() => setDialog({ mode: "link", tile })} />;
    if (linked.type === "scene") return <SceneTile scene={linked.scene} config={tile} interactive={interactive} onRun={() => runScene(linked.scene)} />;
    if (linked.type === "camera") {
      if (preview) return <CameraPreview name={linked.camera.name} />;
      const live = <CameraTile camera={linked.camera} fill />;
      return staged(tile, tile.options?.video === "snapshots"
        ? <SnapshotCamera name={linked.camera.name} every={tile.options.every ?? DEFAULT_SNAPSHOT_SECONDS} still={frame => `/api/cameras/${linked.camera.id}/snapshot?frame=${frame}`} live={live} />
        : live);
    }
    const source = linked.device;
    // A tile can carry its own name and leave the room off; commands still go to the device itself.
    const device = { ...source, name: tile.label?.trim() || source.name, room: tile.options?.hideRoom ? null : source.room } as typeof source;
    const hold = tile.options?.hold;
    const scene = hold?.startsWith("scene:") ? home.scenes.find(item => `scene:${item.id}` === hold) : undefined;
    const runs = hold?.startsWith("device:") ? devices.get(hold.slice("device:".length)) : undefined;
    const onHold = !interactive || hold === undefined ? undefined
      : scene ? () => void runScene(scene)
      : runs?.kind === "scene" ? () => void send(runs, { type: "activate" }).catch(() => {})
      : hold === "history" ? () => setCharting(source.id)
      : hold === "controls" && source.kind === "light" ? () => setControlling(source.id)
      : null;
    if (device.kind === "thermostat") return <Thermostat device={device} size={tile.size} preview={preview} onCommand={command => send(device, command)} onOpenHistory={interactive ? () => setCharting(device.id) : undefined} />;
    if (device.kind === "camera") {
      if (preview) return <CameraPreview name={device.name} />;
      const live = <IntegrationCameraTile camera={device} />;
      return staged(tile, tile.options?.video === "snapshots"
        ? <SnapshotCamera name={device.name} every={tile.options.every ?? DEFAULT_SNAPSHOT_SECONDS} still={frame => `/api/devices/${encodeURIComponent(device.id)}/camera?mode=snapshot&frame=${frame}`} live={live} />
        : live);
    }
    if (device.kind === "media_player") return <MediaTile tileId={tile.id} device={device} layout={tile.size === "4x2" ? "player" : "bar"} interactive={interactive} onCommand={command => send(device, command)} />;
    if (device.kind === "vacuum") return <VacuumTile device={device} config={tile} interactive={interactive} onCommand={command => send(device, command)} />;
    if (device.kind === "alarm") return <AlarmTile device={device} config={tile} interactive={interactive} openMethod={home.openMethod} onCommand={(command, pin) => send(device, command, pin)} />;
    if (device.kind === "todo") return <TodoTile device={device} config={tile} interactive={interactive} onCommand={command => send(device, command)} />;
    if (device.kind === "person") return <PersonTile device={device} config={tile} now={minuteNow} />;
    if (device.kind === "binary_sensor" && device.sensorClass === "leak") return <LeakTile device={device} config={tile} />;
    if (device.kind === "sensor" && (tile.size === "2x2" || tile.size === "4x2")) return <ChartTile device={device} config={tile} onOpen={interactive ? () => setCharting(device.id) : undefined} />;
    const linkedCamera = tile.options?.camera ? cameraChoices.find(choice => choice.value === tile.options?.camera) : undefined;
    const camera = linkedCamera && { name: linkedCamera.name, open: () => openCamera(linkedCamera.value, tile.options?.cameraOpens) };
    return <DeviceTile device={device} config={tile} interactive={interactive} openMethod={home.openMethod} onCommand={(command, pin) => send(device, command, pin)} onOpenControls={() => setControlling(device.id)} onOpenHistory={() => setCharting(device.id)} onHold={onHold} camera={camera} />;
  };

  const charted = charting ? devices.get(charting) : undefined;
  const chartedDevice = charted?.kind === "sensor" || charted?.kind === "thermostat" ? charted : null;
  const controlled = controlling ? devices.get(controlling) : undefined;
  const controlledLight = controlled?.kind === "light" ? controlled : null;
  const dialogs = (
    <>
      <TileDialog
        state={dialog}
        onOpenChange={open => !open && setDialog(null)}
        candidates={candidates}
        onAdd={addTile}
        onLink={linkTile}
        onPlace={(tileId, place, units) => change(tiles.map(tile => tile.id === tileId ? { ...tile, options: { ...tile.options, place, units } } : tile))}
        onAddLayout={layout => {
          const placed = new Set(tiles.map(tile => tile.link));
          const cameras = sources.filter(source => source.kind === "camera");
          const fresh = cameras.filter(source => !placed.has(source.id));
          const sizes = new Map(tiles.map(tile => [tile.id, spanOf(tile.size)]));
          const cells = arrange(tiles.map(tile => tile.id), id => sizes.get(id)!, 8, id => tiles.find(tile => tile.id === id)?.at?.[8]);
          const below = Math.max(0, ...[...cells].map(([id, cell]) => cell.row + sizes.get(id)!.rows));
          change([...tiles, ...cameraLayoutTiles(layout, fresh.length ? fresh : cameras, below)]);
        }}
      />
      <CameraSheet name={viewing ? cameraChoices.find(choice => choice.value === viewing)?.name ?? "Camera" : null} onClose={() => setViewing(null)} controls={viewing ? controlsFor(viewing) : []}>
        {viewing && (cameras.get(viewing)
          ? <CameraTile camera={cameras.get(viewing)!} fill />
          : (() => { const device = devices.get(viewing); return device?.kind === "camera" ? <IntegrationCameraTile camera={device} /> : null; })())}
      </CameraSheet>
      <WidgetEditor state={managing} items={home.widgets} onOpenChange={open => !open && setManaging(null)}
        onLink={(tileId, itemId) => change(tiles.map(tile => tile.id === tileId ? { ...tile, options: { ...tile.options, itemId } } : tile))} />
      <StopsDialog open={stopsFor !== null} ready={home.transitReady} sample={home.transitSample} initial={tiles.find(tile => tile.id === stopsFor)?.options?.stops ?? []} onOpenChange={open => !open && setStopsFor(null)}
        onSave={stops => stopsFor && change(tiles.map(tile => tile.id === stopsFor ? { ...tile, options: { ...tile.options, stops } } : tile))} />
      <WifiShare items={itemsOf(home.widgets, "wifi")} itemId={sharing} onOpenChange={open => !open && setSharing(undefined)} />
      <HistorySheet device={chartedDevice} onOpenChange={open => !open && setCharting(null)} />
      <LightControls device={controlledLight} onOpenChange={open => !open && setControlling(null)} onCommand={send} />
      <SceneEditor open={sceneEditing !== null} onOpenChange={open => !open && setSceneEditing(null)} devices={home.devices} scene={sceneEditing === "new" ? null : sceneEditing}
        onSaved={(id, created) => {
          if (created && id) change([...tiles, createTile("scene", sceneTileId(id))]);
          void refresh();
        }} />
      <TileEditor
        tile={editable}
        renderPreview={config => renderTile(config, true)}
        onOpenChange={open => !open && setCustomizing(null)}
        onChange={patch => customizing && change(updateTile(tiles, customizing, patch))}
        rooms={home.rooms}
        onIdentity={async change => {
          const id = editable?.identity?.id;
          if (!id) return;
          await updateDevice(id, change);
          await refresh();
        }}
        onRemove={() => { if (customizing) change(removeTile(tiles, customizing)); setCustomizing(null); }}
        onRelink={() => {
          if (!customizingTile) return;
          if (customizingTile.kind === "departures") {
            setStopsFor(customizingTile.id);
            setCustomizing(null);
          } else if (isHousehold(customizingTile.kind)) {
            setManaging({ kind: customizingTile.kind, tile: customizingTile, itemId: customizingTile.options?.itemId });
            setCustomizing(null);
          } else {
            setDialog(isWidget(customizingTile.kind) ? { mode: "place", tile: customizingTile } : { mode: "link", tile: customizingTile });
          }
        }}
        extra={customizingScene && (
          <>
            <Button variant="secondary" onClick={() => { setSceneEditing(customizingScene); setCustomizing(null); }}>Edit scene</Button>
            <ConfirmMorph label="Delete scene" prompt={`Delete ${customizingScene.name}?`} pendingLabel="Deleting" doneLabel="Deleted" onConfirm={async () => { await deleteScene(customizingScene.id); setCustomizing(null); await refresh(); }} />
          </>
        )}
      />
    </>
  );

  if (tiles.length === 0 && !canEdit) {
    return (
      <Glass className={styles.placeholder}>
        <EmptyState icon={<LayoutGrid size={24} strokeWidth={1.75} />} title="Nothing shared yet" description="The page you were given has no tiles yet. Ask whoever invited you to add some." />
      </Glass>
    );
  }

  if (tiles.length === 0 && !connected) {
    return (
      <>
        <Welcome name={userName} onCreated={() => refresh()} onWidgets={() => setDialog({ mode: "add" })} />
        {dialogs}
      </>
    );
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.intro} data-on-wall>
        <div>
          <h1 className={styles.title}><Greeting hour={hour} name={userName} /></h1>
          <p className={styles.summary}>
            {today && <span className={styles.today} data-wall-show>{today}</span>}
            {summarize(home.devices)}
            <span className={styles.live} data-wall-hide data-live={live || undefined} title={live ? "Updates arrive as they happen" : "Connecting to live updates"}>{live ? "Live" : "Connecting"}</span>
          </p>
        </div>
        <div className={styles.actions} data-wall-hide={!editing || undefined}>
          {editing ? (
            <>
              {selected ? (
                <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
              ) : (
                <>
                  {clipboard.length > 0 && <Button variant="ghost" onClick={paste}><ClipboardPaste size={16} strokeWidth={1.75} aria-hidden="true" />Paste {clipboard.length}</Button>}
                  {tiles.length > 0 && <Button variant="ghost" onClick={() => setSelected(new Set())}><ListChecks size={16} strokeWidth={1.75} aria-hidden="true" />Select</Button>}
                  <Button variant="ghost" onClick={() => setDialog({ mode: "add" })}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Add tile</Button>
                </>
              )}
              <Button onClick={finishEditing}>Done</Button>
            </>
          ) : (
            <>
              {itemsOf(home.widgets, "wifi").length > 0 && <Button variant="secondary" className={styles.toolButton} aria-label="Show the Wi-Fi QR code" title="Guest Wi-Fi" onClick={() => setSharing(null)}><QrCode size={16} strokeWidth={1.75} aria-hidden="true" /></Button>}
              {canEdit && (
                <DropdownMenu label="Add" icon={<Plus size={16} strokeWidth={1.75} aria-hidden="true" />} items={[
                  { label: "A tile", icon: <LayoutGrid size={16} strokeWidth={1.75} />, onSelect: () => setDialog({ mode: "add" }) },
                  { label: "A scene", icon: <Clapperboard size={16} strokeWidth={1.75} />, onSelect: () => setSceneEditing("new") },
                ]} />
              )}
              {canEdit && tiles.length > 0 && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
            </>
          )}
        </div>
      </header>

      <WallRoomsBridge rooms={linkedRooms} current={current} onWant={showRoom} />
      {linkedRooms.length > 1 && (
        <div className={styles.screens} data-on-wall data-wall-hide>
          <span className={`${glassClass("pill")} ${styles.screenGlass}`}><SegmentedControl label="Room" className={styles.rooms} value={current} onValueChange={showRoom} options={[{ value: ALL_ROOMS, label: "All" }, ...linkedRooms.map(value => ({ value, label: value }))]} /></span>
        </div>
      )}

      {failing.map(integration => (
        <Alert key={integration.id} tone="warning" title={`${integration.name} is not responding`}>{integration.error ?? ""}</Alert>
      ))}

      <div ref={gridWrap} className={styles.swipe} {...swipeHandlers}>
      {tiles.length > 0 ? (
        <HomeGrid tiles={shownTiles} editing={editing} placed={!filtering} renderTile={tile => renderTile(tile)} nameOf={nameOf} onTilesChange={next => change(filtering ? mergeFiltered(tiles, next) : next)} onCustomize={setCustomizing}
          selected={selected} onToggle={id => setSelected(current => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next; })} />
      ) : (
        <Glass className={styles.placeholder}>
          <EmptyState
            icon={<LayoutGrid size={24} strokeWidth={1.75} />}
            title="Build your dashboard"
            description={home.devices.length > 0
              ? `Add tiles for what you use most, then tap each one to link it. ${home.devices.length} ${home.devices.length === 1 ? "device is" : "devices are"} ready to link.`
              : "Add tiles for what you use most, then tap each one to link it to a device."}
            action={(
              <div className={styles.emptyActions}>
                <Button onClick={() => setDialog({ mode: "add" })}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Add a tile</Button>
              </div>
            )}
          />
        </Glass>
      )}
      </div>

      {dialogs}
      {selected && (
        <div className={`${glassClass("pill")} ${styles.selectBar}`} role="toolbar" aria-label="Selected tiles">
          <span className={styles.selectCount}>{selected.size ? `${selected.size} selected` : "Tap tiles to select them"}</span>
          <Button variant="ghost" onClick={() => setSelected(selected.size === tiles.length ? new Set() : new Set(tiles.map(tile => tile.id)))}>{selected.size === tiles.length ? "Select none" : "Select all"}</Button>
          <Button variant="secondary" disabled={!selected.size} onClick={() => {
            setClipboard(tiles.filter(tile => selected.has(tile.id)));
            setSelected(null);
          }}><Copy size={16} strokeWidth={1.75} aria-hidden="true" />Copy</Button>
          <Button variant="danger" disabled={!selected.size} onClick={() => {
            change(tiles.filter(tile => !selected.has(tile.id)));
            setSelected(null);
          }}><Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />Delete</Button>
        </div>
      )}
    </div>
  );
}

function CameraPreview({ name }: { name: string }) {
  return (
    <div className={`${glassClass()} ${styles.cameraPreview}`}>
      <Video size={24} strokeWidth={1.75} aria-hidden="true" />
      <span>{name}</span>
    </div>
  );
}

/** A reorder made while one room is shown, put back into the slots those tiles hold in the whole layout. */
/** Folds a change made in one room back into the whole page: the room's tiles trade the spots they already held, so tiles from other rooms never move. */
function mergeFiltered(all: TileConfig[], changed: TileConfig[]) {
  const ids = new Set(changed.map(tile => tile.id));
  const spots = all.filter(tile => ids.has(tile.id)).map(tile => tile.at);
  const queue = changed.map((tile, index) => ({ ...tile, at: spots[index] ?? tile.at }));
  return all.map(tile => ids.has(tile.id) ? queue.shift() ?? tile : tile);
}

function editableTile(tile: TileConfig, linked: Linked | null, name: string, sourceLabel: (device: Device) => string, scenes: { value: string; name: string }[], cameras: { value: string; name: string }[],
  cameraChoices: { value: string; name: string }[], pages: { value: string; name: string }[]): EditableTile {
  const info = KIND_INFO[tile.kind];
  const base = { config: tile, kind: tile.kind, name, linkedName: null as string | null, adjustable: true, icon: null, color: null };
  if (isWidget(tile.kind)) return { ...base, linkedName: tile.kind === "weather" ? tile.options?.place?.name ?? null : null };
  if (!linked) return { ...base, icon: isStyled(tile.kind) ? tile.icon ?? info.icon : null, color: isStyled(tile.kind) ? tile.color ?? info.color : null };
  if (linked.type === "scene") return { ...base, linkedName: linked.scene.name, adjustable: false, icon: tile.icon ?? linked.scene.icon ?? "clapperboard", color: tile.color ?? "violet" };
  if (linked.type === "camera") {
    const { camera } = linked;
    return { ...base, linkedName: camera.name, adjustable: false, identity: { id: cameraTileId(camera.id), name: camera.name, sourceName: camera.sourceName, room: null, roomEditable: false, source: "Settings" } };
  }
  const device = linked.device;
  const identity = {
    id: device.id, name: device.name, sourceName: device.sourceName, room: device.room, sourceRoom: device.sourceRoom, roomEditable: true, source: sourceLabel(device),
    ...(isSwitchableKind(device.kind) ? { kind: device.kind, sourceKind: device.sourceKind } : {}),
    ...(device.kind === "event" && device.eventClass === "doorbell" ? { doorbellCamera: { value: device.camera ?? null, options: cameras } } : {}),
    quiet: device.quiet ?? false,
  };
  const holds = [
    ...(device.kind === "light" && hasControls(device) ? [{ value: "controls", label: "Open colour and brightness" }] : []),
    ...(device.kind === "sensor" ? [{ value: "history", label: "Show history" }] : []),
    ...scenes.map(scene => ({ value: scene.value, label: `Run ${scene.name}` })),
  ];
  const opens = device.kind === "lock" || device.kind === "cover" || (device.kind === "binary_sensor" && ["door", "window", "garage", "opening"].includes(device.sensorClass));
  const tuning = { tuning: { holds, styled: isStyled(device.kind) }, ...(opens ? { cameraLink: { cameras: cameraChoices, pages } } : {}) };
  if (!isStyled(device.kind)) return { ...base, ...tuning, linkedName: device.name, identity, adjustable: false };
  const style = defaultStyle(device);
  return { ...base, ...tuning, linkedName: device.name, identity, adjustable: hasLevel(device), icon: tile.icon ?? style.icon, color: tile.color ?? style.color };
}

const FIRST_STEPS = [
  { title: "Connect", body: "Pair Home Assistant or a Matter server. Your devices come straight in." },
  { title: "Arrange", body: "Add the tiles you reach for and drag them where you like." },
  { title: "Hang it up", body: "Turn on wall tablet mode, pick a resting clock, and let it wake when someone walks by." },
];

function Welcome({ name, onCreated, onWidgets }: { name: string; onCreated: () => void; onWidgets: () => void }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <div className={styles.welcomeHeading} data-on-wall>
        <h1 id="welcome-title" className={styles.title}>Welcome home{name ? `, ${name.split(" ")[0]}` : ""}</h1>
        <p className={styles.summary}>Bring in your own devices, or look around a sample home first.</p>
      </div>
      <div className={styles.choices}>
        <Glass className={styles.choice}>
          <House className={styles.choiceIcon} size={24} strokeWidth={1.75} aria-hidden="true" />
          <h2 className={styles.choiceTitle}>Connect your home</h2>
          <p className={styles.choiceBody}>Home Assistant, a Matter server, or RTSP cameras through go2rtc. You build the dashboard after.</p>
          <Button className={styles.choiceButton} onClick={() => router.push("/settings#connections")}>Add a connection</Button>
        </Glass>
        <Glass className={styles.choice}>
          <Sparkles className={styles.choiceIcon} size={24} strokeWidth={1.75} aria-hidden="true" />
          <h2 className={styles.choiceTitle}>Explore the demo home</h2>
          <p className={styles.choiceBody}>Simulated lights, fans, locks, a garage door, and a thermostat you can try right away.</p>
          <Button className={styles.choiceButton} variant="secondary" loading={creating} onClick={async () => {
            setCreating(true);
            await addDemoHome();
            onCreated();
            setCreating(false);
          }}>Open the demo home</Button>
        </Glass>
      </div>
      <ol className={styles.firstSteps} aria-label="How setting up goes" data-on-wall>
        {FIRST_STEPS.map((step, index) => (
          <li key={step.title} className={styles.firstStep}>
            <span className={styles.firstStepNumber} aria-hidden="true">{index + 1}</span>
            <span className={styles.firstStepTitle}>{step.title}</span>
            <span className={styles.firstStepBody}>{step.body}</span>
          </li>
        ))}
      </ol>
      <div className={styles.welcomeLinks}>
        <Button variant="ghost" onClick={() => router.push("/guide")}><Compass size={16} strokeWidth={1.75} aria-hidden="true" />How setting up goes</Button>
        <Button variant="ghost" onClick={onWidgets}><Sun size={16} strokeWidth={1.75} aria-hidden="true" />Or start with weather, a calendar, and reminders</Button>
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.dashboard} aria-busy="true">
      <Skeleton lines={2} label="Loading your home" />
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 8 }, (_, index) => <div key={index} className={glassClass("panel")}><Skeleton lines={2} avatar className={styles.skeletonTile} /></div>)}
      </div>
    </div>
  );
}
