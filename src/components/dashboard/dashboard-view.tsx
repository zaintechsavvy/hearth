"use client";

import { House, Sparkles, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Glass, glassClass } from "@/components/glass/glass";
import { addDemoHome, saveLayout } from "@/lib/actions";
import { DEFAULT_COLOR, DEFAULT_ICON, cameraTileId, resolveLayout, updateTile, type TileConfig, type TileSource } from "@/lib/dashboard/layout";
import type { Device, ThermostatDevice } from "@/lib/devices/types";
import { CameraTile } from "./camera-tile";
import { HiddenTilesDrawer } from "./hidden-tiles-drawer";
import { HomeGrid } from "./home-grid";
import { Thermostat, formatTemperature } from "./thermostat";
import { TileEditor, type EditableTile } from "./tile-editor";
import { DeviceTile } from "./tiles/device-tile";
import { useHome } from "./use-home";
import styles from "./dashboard.module.css";

const SAVE_DELAY_MS = 500;
const ALL_ROOMS = "all";
const subscribeNever = () => () => {};

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

const adjustable = (device: Device) => (device.kind === "light" && device.dimmable) || (device.kind === "fan" && device.adjustable);

export function DashboardView({ userName }: { userName: string }) {
  const { home, error, isLoading, live, refresh, send } = useHome();
  const hour = useSyncExternalStore(subscribeNever, () => new Date().getHours(), () => null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TileConfig[] | null>(null);
  const [customizing, setCustomizing] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [room, setRoom] = useState(ALL_ROOMS);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const devices = useMemo(() => new Map((home?.devices ?? []).map(device => [device.id, device])), [home?.devices]);
  const cameras = useMemo(() => new Map((home?.cameras ?? []).map(camera => [cameraTileId(camera.id), camera])), [home?.cameras]);
  const sources = useMemo<TileSource[]>(() => [
    ...[...devices.values()].map(device => ({ id: device.id, kind: device.kind, adjustable: adjustable(device) })),
    ...[...cameras.keys()].map(id => ({ id, kind: "camera" as const })),
  ], [devices, cameras]);
  const tiles = useMemo(() => resolveLayout(draft ?? home?.layout ?? [], sources), [draft, home?.layout, sources]);
  const rooms = useMemo(() => [...new Set([...devices.values()].map(device => device.room).filter((value): value is string => Boolean(value)))].sort(), [devices]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (isLoading && !home) return <DashboardSkeleton />;
  if (error && !home) return <Alert tone="danger" title="Could not load your home">Check that Hearth is running, then reload the page.</Alert>;
  if (!home || (home.integrations.length === 0 && home.cameras.length === 0)) return <Welcome onCreated={() => refresh()} />;

  const nameOf = (tile: TileConfig) => devices.get(tile.id)?.name ?? cameras.get(tile.id)?.name ?? "Tile";

  const change = (next: TileConfig[]) => {
    setDraft(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void saveLayout(next), SAVE_DELAY_MS);
  };

  const finishEditing = async () => {
    clearTimeout(saveTimer.current);
    setEditing(false);
    if (draft) await saveLayout(draft);
    await refresh();
    setDraft(null);
  };

  const shownTiles = room === ALL_ROOMS || editing ? tiles : tiles.filter(tile => devices.get(tile.id)?.room === room);
  const failing = home.integrations.filter(integration => !integration.ok);
  const hiddenCount = tiles.filter(tile => tile.hidden).length;
  const editable = customizing ? editableTile(tiles.find(tile => tile.id === customizing), devices, cameras) : null;

  const renderTile = (tile: TileConfig, preview = false) => {
    const camera = cameras.get(tile.id);
    if (camera) return preview ? <CameraPreview name={camera.name} /> : <CameraTile camera={camera} fill />;
    const device = devices.get(tile.id);
    if (!device) return null;
    if (device.kind === "thermostat") return <Thermostat device={device} onCommand={command => send(device, command)} />;
    return <DeviceTile device={device} config={tile} interactive={!editing && !preview} onCommand={command => send(device, command)} />;
  };

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
              <Button variant="ghost" onClick={() => setShowHidden(true)}>{hiddenCount ? `Hidden (${hiddenCount})` : "Hidden"}</Button>
              <Button onClick={finishEditing}>Done</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
      </header>

      {rooms.length > 1 && !editing && (
        <SegmentedControl label="Room" className={styles.rooms} value={room} onValueChange={setRoom} options={[{ value: ALL_ROOMS, label: "All" }, ...rooms.map(value => ({ value, label: value }))]} />
      )}

      {failing.map(integration => (
        <Alert key={integration.id} tone="warning" title={`${integration.name} is not responding`}>{integration.error ?? ""}</Alert>
      ))}

      {shownTiles.some(tile => !tile.hidden) ? (
        <HomeGrid tiles={shownTiles} editing={editing} renderTile={tile => renderTile(tile)} nameOf={nameOf} onTilesChange={next => change(room === ALL_ROOMS || editing ? next : mergeFiltered(tiles, next))} onCustomize={setCustomizing} />
      ) : (
        <Glass className={styles.placeholder}>
          <EmptyState icon={<Video size={24} strokeWidth={1.75} />} title="Nothing to show here" description="Every tile is hidden. Choose Edit, then Hidden, to bring tiles back." />
        </Glass>
      )}

      <TileEditor tile={editable} renderPreview={config => renderTile(config, true)} onOpenChange={open => !open && setCustomizing(null)} onChange={patch => customizing && change(updateTile(tiles, customizing, patch))} />
      <HiddenTilesDrawer open={showHidden} onOpenChange={setShowHidden} tiles={tiles} nameOf={nameOf} onShow={id => change(updateTile(tiles, id, { hidden: false }))} />
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

function mergeFiltered(all: TileConfig[], changed: TileConfig[]) {
  const updates = new Map(changed.map(tile => [tile.id, tile]));
  return all.map(tile => updates.get(tile.id) ?? tile);
}

function editableTile(tile: TileConfig | undefined, devices: Map<string, Device>, cameras: Map<string, { name: string }>): EditableTile | null {
  if (!tile) return null;
  const camera = cameras.get(tile.id);
  if (camera) return { config: tile, kind: "camera", name: camera.name, adjustable: false, icon: null, color: null };
  const device = devices.get(tile.id);
  if (!device) return null;
  if (device.kind === "thermostat") return { config: tile, kind: "thermostat", name: device.name, adjustable: false, icon: null, color: null };
  return { config: tile, kind: device.kind, name: device.name, adjustable: adjustable(device), icon: tile.icon ?? DEFAULT_ICON[device.kind], color: tile.color ?? DEFAULT_COLOR[device.kind] };
}

function Welcome({ onCreated }: { onCreated: () => void }) {
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
          <p className={styles.choiceBody}>Simulated lights, fans, plugs, and a thermostat you can try right away.</p>
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
          <p className={styles.choiceBody}>Home Assistant, a Matter server, or RTSP cameras through go2rtc.</p>
          <Button className={styles.choiceButton} variant="secondary" onClick={() => router.push("/settings")}>Add a connection</Button>
        </Glass>
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
