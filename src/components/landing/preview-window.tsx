"use client";

import { useState } from "react";
import { HomeGrid } from "@/components/dashboard/home-grid";
import { Thermostat } from "@/components/dashboard/thermostat";
import { DeviceTile, type ToggleDevice } from "@/components/dashboard/tiles/device-tile";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { applyCommand, type Device, type DeviceCommand } from "@/lib/devices/types";
import { seedDemoDevices } from "@/lib/integrations/demo";
import styles from "./preview-window.module.css";

const SAMPLE_LAYOUT: TileConfig[] = [
  { id: "preview:thermostat", size: "2x2" },
  { id: "preview:kitchen-pendants", size: "1x2" },
  { id: "preview:porch", size: "1x1", icon: "lamp-ceiling", color: "amber" },
  { id: "preview:coffee", size: "1x1", icon: "coffee", color: "orange" },
  { id: "sample:front", size: "2x1" },
  { id: "sample:back", size: "2x1" },
];

const SAMPLE_CAMERAS: Record<string, { name: string; scene: "dusk" | "night" }> = {
  "sample:front": { name: "Front door", scene: "dusk" },
  "sample:back": { name: "Backyard", scene: "night" },
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
    if (camera) return <SampleCamera name={camera.name} scene={camera.scene} />;
    const device = byId.get(tile.id);
    if (!device) return null;
    if (device.kind === "thermostat") return <Thermostat device={device} onCommand={send(device.id)} />;
    return <DeviceTile device={device as ToggleDevice} config={tile} onCommand={send(device.id)} />;
  };

  return (
    <figure className={`${glassClass()} ${styles.window}`} aria-label="Interactive preview with sample devices">
      <div className={styles.titlebar}>
        <span className={styles.lights} aria-hidden="true"><i /><i /><i /></span>
        <span className={styles.title}>Sample home</span>
        <span className={styles.tag}>Preview</span>
      </div>
      <div className={styles.body}>
        <HomeGrid tiles={SAMPLE_LAYOUT} editing={false} renderTile={renderTile} nameOf={tile => byId.get(tile.id)?.name ?? SAMPLE_CAMERAS[tile.id]?.name ?? ""} onTilesChange={() => {}} onCustomize={() => {}} />
      </div>
      <figcaption className={styles.caption}>Sample data. Drag the slider or press the arrows.</figcaption>
    </figure>
  );
}

function SampleCamera({ name, scene }: { name: string; scene: "dusk" | "night" }) {
  return (
    <div className={`${glassClass("panel")} ${styles.camera}`} data-scene={scene}>
      <span className={styles.sceneSky} aria-hidden="true" />
      <span className={styles.sceneGround} aria-hidden="true" />
      <span className={styles.sceneLamp} aria-hidden="true" />
      <span className={`${glassClass("pill")} ${styles.cameraLabel}`}>{name}<em>Sample</em></span>
    </div>
  );
}
