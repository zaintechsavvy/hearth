"use client";

import { useState } from "react";
import { DeviceTile } from "@/components/dashboard/device-tile";
import { Thermostat } from "@/components/dashboard/thermostat";
import { glassClass } from "@/components/glass/glass";
import { applyCommand, type Device, type DeviceCommand, type ThermostatDevice } from "@/lib/devices/types";
import { seedDemoDevices } from "@/lib/integrations/demo";
import styles from "./preview-window.module.css";

const SAMPLE_TILES = ["kitchen-pendants", "bedroom-fan", "porch", "coffee"];
const SHORT_NAMES: Record<string, string> = { "preview:kitchen-pendants": "Kitchen", "preview:coffee": "Coffee" };

function sampleHome(): Device[] {
  return seedDemoDevices("preview").map(device => device.kind === "thermostat"
    ? { ...device, mode: "auto", action: null, current: 21, target: 21 }
    : { ...device, name: SHORT_NAMES[device.id] ?? device.name });
}

/** A self-contained, clearly labelled sample. Nothing here talks to a server. */
export function PreviewWindow() {
  const [devices, setDevices] = useState(sampleHome);

  const send = (id: string) => async (command: DeviceCommand) => {
    await new Promise(resolve => setTimeout(resolve, 160));
    setDevices(current => current.map(device => device.id === id ? applyCommand(device, command) : device));
  };

  const thermostat = devices.find((device): device is ThermostatDevice => device.kind === "thermostat");
  const tiles = SAMPLE_TILES.map(slug => devices.find(device => device.id === `preview:${slug}`)).filter(device => device && device.kind !== "thermostat") as Exclude<Device, ThermostatDevice>[];

  return (
    <figure className={`${glassClass()} ${styles.window}`} aria-label="Interactive preview with sample devices">
      <div className={styles.titlebar}>
        <span className={styles.lights} aria-hidden="true"><i /><i /><i /></span>
        <span className={styles.title}>Sample home</span>
        <span className={styles.tag}>Preview</span>
      </div>
      <div className={styles.body}>
        {thermostat && <Thermostat device={thermostat} onCommand={send(thermostat.id)} />}
        <div className={styles.tiles}>
          {tiles.map(device => <DeviceTile key={device.id} device={device} onCommand={send(device.id)} />)}
        </div>
        <div className={styles.cameras}>
          <SampleCamera name="Front door" scene="dusk" />
          <SampleCamera name="Backyard" scene="night" />
        </div>
      </div>
      <figcaption className={styles.caption}>Sample data. Try the thermostat arrows.</figcaption>
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
