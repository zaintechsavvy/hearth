"use client";

import { House, LayoutGrid, Palette, Plus, Sparkles, Sun, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Glass, glassClass, glassSheetClass } from "@/components/glass/glass";
import { BackgroundPicker } from "@/components/shell/background-picker";
import { addDemoHome, deleteScene, saveLayout, updateDevice } from "@/lib/actions";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { PageTabs } from "./page-tabs";
import { ADD_TILE_EVENT } from "@/components/shell/command-menu";
import type { HomeCamera } from "@/lib/home";
import { INTEGRATION_LABELS } from "@/lib/integrations/types";
import { KIND_INFO } from "@/lib/dashboard/catalog";
import {
  cameraTileId, createTile, defaultSize, HOME_PAGE_ID, isStyled, isWidget, removeTile, resolveLayout, SIZE_OPTIONS, suggestedTiles, updateTile,
  type TileConfig, type TileKind, type TileSource,
} from "@/lib/dashboard/layout";
import { hasLevel, tileSources } from "@/lib/dashboard/sources";
import { defaultStyle } from "@/lib/dashboard/style";
import { kindLabel, statusText } from "@/lib/devices/status";
import type { Device, DeviceKind, ThermostatDevice } from "@/lib/devices/types";
import { sceneTileId, type HearthScene } from "@/lib/scenes/types";
import { CameraTile } from "./camera-tile";
import { DoorbellBanner } from "./doorbell-banner";
import type { Candidate } from "./entity-chooser";
import { HomeGrid } from "./home-grid";
import { IntegrationCameraTile } from "./integration-camera-tile";
import { LightControls } from "./light-controls";
import { SceneEditor } from "./scene-editor";
import { Thermostat, formatTemperature } from "./thermostat";
import { TileDialog, type TileDialogMode } from "./tile-dialog";
import { TileEditor, type EditableTile } from "./tile-editor";
import { DeviceTile } from "./tiles/device-tile";
import { PlaceholderTile } from "./tiles/placeholder-tile";
import { SceneTile } from "./tiles/scene-tile";
import { useHome } from "./use-home";
import { CalendarTile } from "./widgets/calendar-tile";
import { ClockTile } from "./widgets/clock-tile";
import { RemindersTile } from "./widgets/reminders-tile";
import { WeatherTile } from "./widgets/weather-tile";
import { BinsTile } from "./household/bins-tile";
import { CountdownTile } from "./household/countdown-tile";
import { HouseholdAlerts } from "./household/household-alerts";
import { MedicationsTile } from "./household/medications-tile";
import { NotesTile } from "./household/notes-tile";
import { PlantsTile } from "./household/plants-tile";
import { TimersTile } from "./household/timers-tile";
import { WidgetEditor, isHousehold, ITEM_KIND_FOR, type WidgetEditorState } from "./household/widget-editor";
import { WifiTile } from "./household/wifi-tile";
import { itemsOf } from "@/lib/widgets/items";
import styles from "./dashboard.module.css";

const SAVE_DELAY_MS = 500;
const PAGE_KEY = "hearth-page";
const SWIPE_PX = 70;
const ALL_ROOMS = "all";
const LEVEL_SIZES = new Set(["1x2", "2x2"]);
const subscribeNever = () => () => {};

/** Devices that can stand in for a tile type: a chandelier on a smart switch is still a light to the person adding it. */
const COMPATIBLE: Partial<Record<TileKind, DeviceKind[]>> = {
  light: ["light", "switch"],
  switch: ["switch", "light"],
  fan: ["fan", "switch"],
  event: ["event", "binary_sensor"],
};

type Linked =
  | { type: "device"; device: Device }
  | { type: "camera"; camera: HomeCamera }
  | { type: "scene"; scene: HearthScene };

function greeting(hour: number | null, name: string) {
  const first = name.split(" ")[0];
  if (hour === null) return `Welcome home, ${first}`;
  return `${hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${first}`;
}

function summarize(devices: Device[]) {
  const lights = devices.filter(device => device.kind === "light" && device.on).length;
  const thermostat = devices.find((device): device is ThermostatDevice => device.kind === "thermostat" && device.current !== null);
  const parts = [lights === 0 ? "All lights off" : `${lights} ${lights === 1 ? "light" : "lights"} on`];
  if (thermostat?.current != null) parts.push(`${formatTemperature(thermostat.current)}° inside`);
  return parts.join(" · ");
}

export function DashboardView({ userName }: { userName: string }) {
  const { home, error, isLoading, live, refresh, send, runScene } = useHome();
  const [sceneEditing, setSceneEditing] = useState<HearthScene | "new" | null>(null);
  const hour = useSyncExternalStore(subscribeNever, () => new Date().getHours(), () => null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TileConfig[] | null>(null);
  const [customizing, setCustomizing] = useState<string | null>(null);
  const [dialog, setDialog] = useState<TileDialogMode | null>(null);
  const [controlling, setControlling] = useState<string | null>(null);
  const [managing, setManaging] = useState<WidgetEditorState | null>(null);
  const [room, setRoom] = useState(ALL_ROOMS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef<TileConfig[] | null>(null);
  const editingRef = useRef(false);

  const devices = useMemo(() => new Map((home?.devices ?? []).map(device => [device.id, device])), [home?.devices]);
  const cameras = useMemo(() => new Map((home?.cameras ?? []).map(camera => [cameraTileId(camera.id), camera])), [home?.cameras]);
  const scenes = useMemo(() => new Map((home?.scenes ?? []).map(scene => [sceneTileId(scene.id), scene])), [home?.scenes]);
  const sources = useMemo<TileSource[]>(() => home ? tileSources(home) : [], [home]);
  const sourceById = useMemo(() => new Map(sources.map(source => [source.id, source])), [sources]);
  const [storedPage, setStoredPage] = useStoredJson<string>(PAGE_KEY, HOME_PAGE_ID);
  const page = home?.pages.find(item => item.id === storedPage) ?? home?.pages[0];
  const pageId = page?.id ?? HOME_PAGE_ID;
  const tiles = useMemo(() => resolveLayout(draft ?? page?.layout ?? [], sources), [draft, page?.layout, sources]);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => clearTimeout(saveTimer.current), []);
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
  const pageIndex = home.pages.findIndex(item => item.id === pageId);
  const swipeHandlers = home.pages.length > 1 && !editing ? {
    onPointerDown: (event: React.PointerEvent) => { if (event.pointerType === "touch") swipe.current = { x: event.clientX, y: event.clientY }; },
    onPointerUp: (event: React.PointerEvent) => {
      const start = swipe.current;
      swipe.current = null;
      if (!start) return;
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      const next = home.pages[pageIndex + (dx < 0 ? 1 : -1)];
      if (next) selectPage(next.id);
    },
  } : {};

  const finishEditing = async () => {
    clearTimeout(saveTimer.current);
    setEditing(false);
    if (draft) await saveLayout(draft, pageId);
    await refresh();
    setDraft(null);
  };

  const fitSize = (tile: TileConfig, kind: TileKind, source: TileSource | undefined) => {
    const allowed = SIZE_OPTIONS[kind].some(option => option.size === tile.size);
    const needsLevel = LEVEL_SIZES.has(tile.size) && SIZE_OPTIONS[kind].length > 2;
    return allowed && !(needsLevel && !source?.adjustable) ? tile.size : defaultSize(kind, source?.adjustable);
  };

  const addTile = (kind: TileKind, link: string | null, options?: TileConfig["options"]) => {
    const source = link ? sourceById.get(link) : undefined;
    const tile = createTile(source?.kind ?? kind, link, source?.adjustable ?? false, options ? { options } : {});
    change([...tiles, tile]);
    if (isHousehold(kind) && (kind === "countdown" || kind === "wifi" || (["bins", "medications", "plants"].includes(kind) && itemsOf(home.widgets, ITEM_KIND_FOR[kind]).length === 0))) {
      setManaging({ kind, tile });
    }
  };

  const linkTile = (tileId: string, link: string) => {
    const source = sourceById.get(link);
    change(tiles.map(tile => {
      if (tile.id !== tileId) return tile;
      const kind = source?.kind ?? tile.kind;
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
  const filtering = room !== ALL_ROOMS && !editing && linkedRooms.includes(room);
  const shownTiles = filtering ? tiles.filter(tile => roomOf(tile) === room) : tiles;
  const failing = home.integrations.filter(integration => !integration.ok);
  const connected = home.integrations.length > 0 || home.cameras.length > 0;
  const customizingTile = customizing ? tiles.find(tile => tile.id === customizing) : undefined;
  const sourceLabel = (device: Device) => {
    const integration = home.integrations.find(item => item.id === device.integrationId);
    return integration ? INTEGRATION_LABELS[integration.kind] : "The integration";
  };
  const editable = customizingTile ? editableTile(customizingTile, resolve(customizingTile), nameOf(customizingTile), sourceLabel) : null;
  const customizingLink = customizingTile ? resolve(customizingTile) : null;
  const customizingScene = customizingLink?.type === "scene" ? customizingLink.scene : null;

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
        return <WifiTile tile={tile} items={itemsOf(home.widgets, "wifi")} interactive={interactive} onManage={itemId => setManaging({ kind: "wifi", tile, itemId })} />;
      case "timers":
        return <TimersTile tile={tile} items={itemsOf(home.widgets, "timer")} interactive={interactive} onManage={() => setManaging({ kind: "timers", tile })} />;
      case "plants":
        return <PlantsTile tile={tile} items={itemsOf(home.widgets, "plant")} interactive={interactive} onManage={itemId => setManaging({ kind: "plants", tile, itemId })} />;
    }
    const linked = resolve(tile);
    if (!linked) return <PlaceholderTile tile={tile} missing={tile.link !== null} interactive={interactive} onLink={() => setDialog({ mode: "link", tile })} />;
    if (linked.type === "scene") return <SceneTile scene={linked.scene} config={tile} interactive={interactive} onRun={() => runScene(linked.scene)} />;
    if (linked.type === "camera") return preview ? <CameraPreview name={linked.camera.name} /> : <CameraTile camera={linked.camera} fill />;
    const device = linked.device;
    if (device.kind === "thermostat") return <Thermostat device={device} onCommand={command => send(device, command)} />;
    if (device.kind === "camera") return preview ? <CameraPreview name={device.name} /> : <IntegrationCameraTile camera={device} />;
    return <DeviceTile device={device} config={tile} interactive={interactive} onCommand={command => send(device, command)} onOpenControls={() => setControlling(device.id)} />;
  };

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
      />
      <WidgetEditor state={managing} items={home.widgets} onOpenChange={open => !open && setManaging(null)}
        onLink={(tileId, itemId) => change(tiles.map(tile => tile.id === tileId ? { ...tile, options: { ...tile.options, itemId } } : tile))} />
      <HouseholdAlerts items={home.widgets} />
      <LightControls device={controlledLight} onOpenChange={open => !open && setControlling(null)} onCommand={send} />
      <SceneEditor open={sceneEditing !== null} onOpenChange={open => !open && setSceneEditing(null)} devices={home.devices} scene={sceneEditing === "new" ? null : sceneEditing} onSaved={() => refresh()} />
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
          if (isHousehold(customizingTile.kind)) {
            setManaging({ kind: customizingTile.kind, tile: customizingTile, itemId: customizingTile.options?.itemId });
            setCustomizing(null);
          } else {
            setDialog(isWidget(customizingTile.kind) ? { mode: "place", tile: customizingTile } : { mode: "link", tile: customizingTile });
          }
        }}
        extra={customizingScene && (
          <>
            <Button variant="secondary" onClick={() => { setSceneEditing(customizingScene); setCustomizing(null); }}>Edit scene</Button>
            <Button variant="ghost" onClick={async () => { await deleteScene(customizingScene.id); setCustomizing(null); await refresh(); }}>Delete scene</Button>
          </>
        )}
      />
    </>
  );

  if (tiles.length === 0 && !connected) {
    return (
      <>
        <Welcome onCreated={() => refresh()} onWidgets={() => setDialog({ mode: "add" })} />
        {dialogs}
      </>
    );
  }

  const suggestions = suggestedTiles(sources);
  return (
    <div className={styles.dashboard}>
      <header className={styles.intro}>
        <div>
          <h1 className={styles.title}>{greeting(hour, userName)}</h1>
          <p className={styles.summary}>
            {summarize(home.devices)}
            <span className={styles.live} data-live={live || undefined} title={live ? "Updates arrive as they happen" : "Connecting to live updates"}>{live ? "Live" : "Connecting"}</span>
          </p>
        </div>
        <div className={styles.actions}>
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => setDialog({ mode: "add" })}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Add tile</Button>
              <Button onClick={finishEditing}>Done</Button>
            </>
          ) : (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className={styles.iconButton} aria-label="Background" title="Background"><Palette size={16} strokeWidth={1.75} aria-hidden="true" /></Button>
                </PopoverTrigger>
                <PopoverContent align="end" className={`${glassSheetClass} ${styles.backgroundPopover}`}>
                  <h2 className={styles.popoverTitle}>Background</h2>
                  <BackgroundPicker />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" onClick={() => setSceneEditing("new")}>New scene</Button>
              <Button variant="ghost" onClick={() => setDialog({ mode: "add" })}><Plus size={16} strokeWidth={1.75} aria-hidden="true" />Add tile</Button>
              {tiles.length > 0 && <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>}
            </>
          )}
        </div>
      </header>

      <PageTabs pages={home.pages} current={pageId} editing={editing} onSelect={selectPage} onChanged={refresh} />

      {linkedRooms.length > 1 && !editing && (
        <SegmentedControl label="Room" className={styles.rooms} value={filtering ? room : ALL_ROOMS} onValueChange={setRoom} options={[{ value: ALL_ROOMS, label: "All" }, ...linkedRooms.map(value => ({ value, label: value }))]} />
      )}

      <DoorbellBanner devices={home.devices} />

      {failing.map(integration => (
        <Alert key={integration.id} tone="warning" title={`${integration.name} is not responding`}>{integration.error ?? ""}</Alert>
      ))}

      {tiles.length > 0 ? (
        <div {...swipeHandlers}>
        <HomeGrid tiles={shownTiles} editing={editing} renderTile={tile => renderTile(tile)} nameOf={nameOf} onTilesChange={next => change(filtering ? mergeFiltered(tiles, next) : next)} onCustomize={setCustomizing} onRemove={id => change(removeTile(tiles, id))} />
        </div>
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
                {suggestions.length > 0 && <Button variant="secondary" onClick={() => change(suggestions)}>Start with suggestions</Button>}
              </div>
            )}
          />
        </Glass>
      )}

      {dialogs}
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
function mergeFiltered(all: TileConfig[], changed: TileConfig[]) {
  const ids = new Set(changed.map(tile => tile.id));
  const queue = [...changed];
  return all.map(tile => ids.has(tile.id) ? queue.shift() ?? tile : tile);
}

function editableTile(tile: TileConfig, linked: Linked | null, name: string, sourceLabel: (device: Device) => string): EditableTile {
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
  const identity = { id: device.id, name: device.name, sourceName: device.sourceName, room: device.room, sourceRoom: device.sourceRoom, roomEditable: true, source: sourceLabel(device) };
  if (!isStyled(device.kind)) return { ...base, linkedName: device.name, identity, adjustable: false };
  const style = defaultStyle(device);
  return { ...base, linkedName: device.name, identity, adjustable: hasLevel(device), icon: tile.icon ?? style.icon, color: tile.color ?? style.color };
}

function Welcome({ onCreated, onWidgets }: { onCreated: () => void; onWidgets: () => void }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <div className={styles.welcomeHeading}>
        <h1 id="welcome-title" className={styles.title}>Welcome to Hearth</h1>
        <p className={styles.summary}>Start with a sample home, or bring in your own devices.</p>
      </div>
      <div className={styles.choices}>
        <Glass className={styles.choice}>
          <Sparkles className={styles.choiceIcon} size={24} strokeWidth={1.75} aria-hidden="true" />
          <h2 className={styles.choiceTitle}>Explore the demo home</h2>
          <p className={styles.choiceBody}>Simulated lights, fans, locks, a garage door, and a thermostat you can try right away.</p>
          <Button className={styles.choiceButton} loading={creating} onClick={async () => {
            setCreating(true);
            await addDemoHome();
            onCreated();
            setCreating(false);
          }}>Open the demo home</Button>
        </Glass>
        <Glass className={styles.choice}>
          <House className={styles.choiceIcon} size={24} strokeWidth={1.75} aria-hidden="true" />
          <h2 className={styles.choiceTitle}>Connect your home</h2>
          <p className={styles.choiceBody}>Home Assistant, a Matter server, or RTSP cameras through go2rtc. You build the dashboard after.</p>
          <Button className={styles.choiceButton} variant="secondary" onClick={() => router.push("/settings")}>Add a connection</Button>
        </Glass>
      </div>
      <Button variant="ghost" className={styles.widgetsOnly} onClick={onWidgets}><Sun size={16} strokeWidth={1.75} aria-hidden="true" />Or start with weather, a calendar, and reminders</Button>
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
