"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { HomeGrid } from "@/components/dashboard/home-grid";
import { useTick } from "@/components/dashboard/household/use-tick";
import { Thermostat } from "@/components/dashboard/thermostat";
import { DeviceTile, type TileDevice } from "@/components/dashboard/tiles/device-tile";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { applyCommand, type Device, type DeviceCommand } from "@/lib/devices/types";
import { seedDemoDevices } from "@/lib/integrations/demo";
import styles from "./preview-window.module.css";

/** Cameras are wide feeds, except on a phone, where a 2x1 tile is too short to make out. */
const PHONE = "(max-width: 640px)";

const sampleLayout = (phone: boolean): TileConfig[] => [
  { id: "preview:thermostat", kind: "thermostat", link: "preview:thermostat", size: "2x2" },
  { id: "preview:kitchen-pendants", kind: "light", link: "preview:kitchen-pendants", size: "1x2" },
  { id: "preview:porch", kind: "light", link: "preview:porch", size: "1x1", icon: "lamp-ceiling", color: "amber" },
  { id: "preview:coffee", kind: "switch", link: "preview:coffee", size: "1x1", icon: "coffee", color: "orange" },
  { id: "sample:front", kind: "camera", link: "sample:front", size: phone ? "2x2" : "2x1" },
  { id: "sample:back", kind: "camera", link: "sample:back", size: phone ? "2x2" : "2x1" },
];

function usePhone() {
  return useSyncExternalStore(
    onChange => { const query = matchMedia(PHONE); query.addEventListener("change", onChange); return () => query.removeEventListener("change", onChange); },
    () => matchMedia(PHONE).matches,
    () => false,
  );
}

interface SampleCameraFeed {
  name: string;
  src: string;
  alt: string;
}

/** Stills from real cameras; the caption below credits them. */
const SAMPLE_CAMERAS: Record<string, SampleCameraFeed> = {
  "sample:front": { name: "Front door", src: "/samples/front-door-doorbell.jpg", alt: "Wide angle doorbell camera view of a visitor at the front door at dusk" },
  "sample:back": { name: "Backyard", src: "/samples/backyard-wyze.jpg", alt: "Wide angle security camera view of a fenced backyard lawn and garden bed" },
};

function sampleHome(): Device[] {
  return seedDemoDevices("preview").map(device => device.kind === "thermostat" ? { ...device, mode: "auto", action: null, current: 21, target: 21 } : device);
}

/** A self-contained, clearly labelled sample built from the real dashboard tiles. Nothing here talks to a server. */
export function PreviewWindow() {
  const [devices, setDevices] = useState(sampleHome);
  const phone = usePhone();
  const byId = new Map(devices.map(device => [device.id, device]));

  const send = (id: string) => async (command: DeviceCommand) => {
    await new Promise(resolve => setTimeout(resolve, 160));
    setDevices(current => current.map(device => device.id === id ? applyCommand(device, command) : device));
  };

  const renderTile = (tile: TileConfig) => {
    const camera = SAMPLE_CAMERAS[tile.id];
    if (camera) return <SampleCamera feed={camera} />;
    const device = byId.get(tile.id);
    if (!device) return null;
    if (device.kind === "thermostat") return <Thermostat device={device} onCommand={send(device.id)} />;
    return <DeviceTile device={device as TileDevice} config={tile} onCommand={send(device.id)} />;
  };

  return (
    <figure className={`${glassClass()} ${styles.window}`} aria-label="Interactive preview with sample devices">
      <div className={styles.titlebar}>
        <span className={styles.lights} aria-hidden="true"><i /><i /><i /></span>
        <span className={styles.title}>Sample home</span>
        <span className={styles.tag}>Preview</span>
      </div>
      <div className={styles.body}>
        <HomeGrid tiles={sampleLayout(phone)} editing={false} renderTile={renderTile} nameOf={tile => byId.get(tile.id)?.name ?? SAMPLE_CAMERAS[tile.id]?.name ?? ""} onTilesChange={() => {}} onCustomize={() => {}} />
      </div>
      <figcaption className={styles.caption}>
        Sample data. Drag the slider or press the arrows.
        <span className={styles.credits}>
          Camera stills: <a href="https://commons.wikimedia.org/wiki/File:Ring_Video_Doorbell_2_capture_video_quality.jpg">Amin</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
          {" · "}<a href="https://us1.discourse-cdn.com/wyze/original/3X/1/3/13166493ba872594211d10277fc20487b60cb940.jpeg">Wyze Community</a>, cropped
        </span>
      </figcaption>
    </figure>
  );
}

function SampleCamera({ feed }: { feed: SampleCameraFeed }) {
  const now = useTick(1000);
  return (
    <div className={`${glassClass("panel")} ${styles.camera}`}>
      <Image className={styles.feed} src={feed.src} alt={feed.alt} fill sizes="(max-width: 720px) 100vw, 420px" />
      <span className={styles.grain} aria-hidden="true" />
      <span className={styles.cameraLabel}><span className={styles.live} aria-hidden="true" />{feed.name}</span>
      {now && <time className={styles.stamp} dateTime={new Date(now).toISOString()}>{new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })}</time>}
    </div>
  );
}
