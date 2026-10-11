"use client";

import { SlidersHorizontal } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/arc/button/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/arc/drawer/drawer";
import { Select } from "@/components/arc/select/select";
import { Switch } from "@/components/arc/switch/switch";
import { setDeviceHidden, setThermostat } from "@/lib/actions";
import type { Device } from "@/lib/devices/types";
import styles from "./customize-drawer.module.css";

interface CustomizeDrawerProps {
  devices: Device[];
  hidden: string[];
  thermostatId: string | null;
  onChange: () => void;
}

export function CustomizeDrawer({ devices, hidden, thermostatId, onChange }: CustomizeDrawerProps) {
  const [, startTransition] = useTransition();
  const [optimisticHidden, setOptimisticHidden] = useOptimistic(new Set(hidden), (current, change: { id: string; hidden: boolean }) => {
    const next = new Set(current);
    if (change.hidden) next.add(change.id);
    else next.delete(change.id);
    return next;
  });
  const thermostats = devices.filter(device => device.kind === "thermostat");
  const tiles = devices.filter(device => device.kind !== "thermostat");

  const toggle = (id: string, show: boolean) => startTransition(async () => {
    setOptimisticHidden({ id, hidden: !show });
    await setDeviceHidden(id, !show);
    onChange();
  });

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="secondary"><SlidersHorizontal size={16} strokeWidth={1.75} aria-hidden="true" /> Customize</Button>
      </DrawerTrigger>
      <DrawerContent title="Customize your home" description="Choose the thermostat and which devices appear on the dashboard.">
        <div className={styles.body}>
          {thermostats.length > 1 && (
            <Select
              label="Thermostat"
              value={thermostatId ?? undefined}
              onValueChange={id => startTransition(async () => { await setThermostat(id); onChange(); })}
              options={thermostats.map(device => ({ value: device.id, label: device.name }))}
            />
          )}
          <section aria-labelledby="customize-devices" className={styles.section}>
            <h3 id="customize-devices" className={styles.heading}>Devices</h3>
            <ul className={styles.list}>
              {tiles.map(device => (
                <li key={device.id} className={styles.row}>
                  <span id={`show-${device.id}`} className={styles.name}>{device.name}</span>
                  <Switch aria-labelledby={`show-${device.id}`} checked={!optimisticHidden.has(device.id)} onCheckedChange={show => toggle(device.id, show)} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
