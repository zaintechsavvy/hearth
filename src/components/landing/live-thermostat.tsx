"use client";

import { useState } from "react";
import { Thermostat } from "@/components/dashboard/thermostat";
import { applyCommand, type DeviceCommand, type ThermostatDevice } from "@/lib/devices/types";
import styles from "./landing.module.css";

const START: ThermostatDevice = {
  id: "landing:thermostat", integrationId: "landing", name: "Living room", room: "Living room", available: true,
  kind: "thermostat", unit: "C", current: 21.5, target: 19, min: 10, max: 30, step: 0.5, mode: "cool", modes: ["off", "heat", "cool", "auto"],
  action: "cooling", humidity: 44, preset: null, presets: [], fanMode: null, fanModes: [],
};

/** What a thermostat set this way would be doing: heating up to its target, cooling down to it, or holding. */
function running(device: ThermostatDevice): ThermostatDevice {
  const gap = (device.target ?? device.current ?? 0) - (device.current ?? 0);
  const action = device.mode === "off" ? "off"
    : (device.mode === "heat" || device.mode === "auto") && gap > 0.3 ? "heating"
    : (device.mode === "cool" || device.mode === "auto") && gap < -0.3 ? "cooling"
    : "idle";
  return { ...device, action };
}

/** The real thermostat tile, working on its own with nothing behind it, to try on the landing page. */
export function LiveThermostat() {
  const [device, setDevice] = useState(START);
  const onCommand = async (command: DeviceCommand) => setDevice(current => running(applyCommand(current, command)));
  return (
    <div className={styles.liveThermostat}>
      <Thermostat device={device} size="3x3" onCommand={onCommand} />
    </div>
  );
}
