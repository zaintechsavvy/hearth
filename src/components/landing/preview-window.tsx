"use client";

import Image from "next/image";
import { useState } from "react";
import { HomeGrid } from "@/components/dashboard/home-grid";
import { useTick } from "@/components/dashboard/household/use-tick";
import { Thermostat } from "@/components/dashboard/thermostat";
import { DeviceTile, type TileDevice } from "@/components/dashboard/tiles/device-tile";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { applyCommand, type Device, type DeviceCommand } from "@/lib/devices/types";
import { seedDemoDevices } from "@/lib/integrations/demo";
import styles from "./preview-window.module.css";

const SAMPLE_LAYOUT: TileConfig[] = [
  { id: "preview:thermostat", kind: "thermostat", link: "preview:thermostat", size: "2x2" },
  { id: "preview:kitchen-pendants", kind: "light", link: "preview:kitchen-pendants", size: "1x2" },
  { id: "preview:porch", kind: "light", link: "preview:porch", size: "1x1", icon: "lamp-ceiling", color: "amber" },
  { id: "preview:coffee", kind: "switch", link: "preview:coffee", size: "1x1", icon: "coffee", color: "orange" },
  { id: "sample:front", kind: "camera", link: "sample:front", size: "2x1" },
  { id: "sample:back", kind: "camera", link: "sample:back", size: "2x1" },
];

interface SampleCameraFeed {
  name: string;
  src: string;
  alt: string;
  nightVision?: boolean;
}

/** Licensed stills; the credits in the caption below are what the licences require. */
const SAMPLE_CAMERAS: Record<string, SampleCameraFeed> = {
  "sample:front": { name: "Front door", src: "/samples/front-door.jpg", alt: "A cottage front door at night, lit by two porch lamps" },
  "sample:back": { name: "Backyard", src: "/samples/backyard.jpg", alt: "Night vision view of a fox standing in a backyard beside an old wagon wheel", nightVision: true },
};

function sampleHome(): Device[] {
  return seedDemoDevices("preview").map(device => device.kind === "thermostat" ? { ...device, mode: "auto", action: null, current: 21, target: 21 } : device);
}

/** A self-contained, clearly labelled sample built from the real dashboard tiles. Nothing here talks to a server. */
export function PreviewWindow() {
  const [devices, setDevices] = useState(sampleHome);
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
        <HomeGrid tiles={SAMPLE_LAYOUT} editing={false} renderTile={renderTile} nameOf={tile => byId.get(tile.id)?.name ?? SAMPLE_CAMERAS[tile.id]?.name ?? ""} onTilesChange={() => {}} onCustomize={() => {}} onRemove={() => {}} />
      </div>
      <figcaption className={styles.caption}>
        Sample data. Drag the slider or press the arrows.
        <span className={styles.credits}>
          Camera photos: <a href="https://commons.wikimedia.org/wiki/File:Cottage_front_porch_at_night_in_Nuthurst,_West_Sussex_England.jpg">Acabashi</a>, <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>
          {" · "}<a href="https://www.flickr.com/photos/larry1732/52495195968/">Larry Lamsa</a>, <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a>, cropped
        </span>
      </figcaption>
    </figure>
  );
}

function SampleCamera({ feed }: { feed: SampleCameraFeed }) {
  const now = useTick(1000);
  return (
    <div className={`${glassClass("panel")} ${styles.camera}`} data-night-vision={feed.nightVision || undefined}>
      <Image className={styles.feed} src={feed.src} alt={feed.alt} fill sizes="(max-width: 720px) 100vw, 420px" />
      <span className={styles.grain} aria-hidden="true" />
      <span className={`${glassClass("pill")} ${styles.cameraLabel}`}>
        <span className={styles.live} aria-hidden="true" />{feed.name}<em>{feed.nightVision ? "Night vision" : "Sample"}</em>
      </span>
      <span className={styles.stamp} aria-hidden="true">
        {now ? new Date(now).toLocaleString(undefined, { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
      </span>
    </div>
  );
}
