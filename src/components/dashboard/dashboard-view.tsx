"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Plus, Sparkles, Thermometer, Video } from "lucide-react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { Glass, glassClass } from "@/components/glass/glass";
import { addDemoHome } from "@/lib/actions";
import type { Device, ThermostatDevice } from "@/lib/devices/types";
import { CameraTile } from "./camera-tile";
import { CustomizeDrawer } from "./customize-drawer";
import { DeviceTile } from "./device-tile";
import { Thermostat, formatTemperature } from "./thermostat";
import { useHome } from "./use-home";
import styles from "./dashboard.module.css";

const CAMERA_SLOTS = 2;
const subscribeNever = () => () => {};

function greeting(hour: number | null, name: string) {
  const first = name.split(" ")[0];
  if (hour === null) return `Welcome home, ${first}`;
  return `${hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"}, ${first}`;
}

function summarize(devices: Device[], thermostat: ThermostatDevice | undefined) {
  const lights = devices.filter(device => device.kind === "light" && device.on).length;
  const parts = [lights === 0 ? "All lights off" : `${lights} ${lights === 1 ? "light" : "lights"} on`];
  if (thermostat?.current != null) parts.push(`${formatTemperature(thermostat.current)}° inside`);
  return parts.join(" · ");
}

interface DashboardViewProps {
  userName: string;
  cameras: { id: string; name: string }[];
}

export function DashboardView({ userName, cameras }: DashboardViewProps) {
  const router = useRouter();
  const { home, error, isLoading, refresh, send } = useHome();
  const hour = useSyncExternalStore(subscribeNever, () => new Date().getHours(), () => null);
  const [creatingDemo, setCreatingDemo] = useState(false);

  if (isLoading && !home) return <DashboardSkeleton />;

  if (error && !home) {
    return <Alert tone="danger" title="Could not load your home">Check that Hearth is running, then reload the page.</Alert>;
  }

  if (!home || home.integrations.length === 0) {
    return (
      <Glass className={styles.empty}>
        <EmptyState
          icon={<Sparkles size={24} strokeWidth={1.75} />}
          title="Your home is quiet"
          description="Connect Home Assistant or a Matter server to bring in your devices, or open the demo home to look around first."
          action={
            <div className={styles.emptyActions}>
              <Button loading={creatingDemo} onClick={async () => {
                setCreatingDemo(true);
                await addDemoHome();
                await refresh();
                setCreatingDemo(false);
              }}>Open the demo home</Button>
              <Button variant="secondary" onClick={() => router.push("/connections")}>Add a connection</Button>
            </div>
          }
        />
      </Glass>
    );
  }

  const hidden = new Set(home.hiddenDevices);
  const thermostats = home.devices.filter((device): device is ThermostatDevice => device.kind === "thermostat");
  const thermostat = thermostats.find(device => device.id === home.thermostatId) ?? thermostats[0];
  const tiles = home.devices.filter(device => device.kind !== "thermostat" && !hidden.has(device.id));
  const failing = home.integrations.filter(integration => !integration.ok);

  return (
    <div className={styles.dashboard}>
      <header className={styles.intro}>
        <div>
          <h1 className={styles.title}>{greeting(hour, userName)}</h1>
          <p className={styles.summary}>{summarize(home.devices, thermostat)}</p>
        </div>
        <CustomizeDrawer devices={home.devices} hidden={home.hiddenDevices} thermostatId={thermostat?.id ?? null} onChange={() => refresh()} />
      </header>

      {failing.map(integration => (
        <Alert key={integration.id} tone="warning" title={`${integration.name} is not responding`}>{integration.error ?? ""}</Alert>
      ))}

      <section className={styles.top} aria-label="Climate and devices">
        {thermostat ? (
          <Thermostat device={thermostat} onCommand={command => send(thermostat, command)} />
        ) : (
          <Glass className={styles.placeholderSquare}>
            <EmptyState icon={<Thermometer size={24} strokeWidth={1.75} />} title="No thermostat yet" description="Thermostats from Home Assistant or Matter appear here once connected." />
          </Glass>
        )}
        {tiles.length > 0 ? (
          <div className={styles.devices}>
            {tiles.map(device => device.kind !== "thermostat" && <DeviceTile key={device.id} device={device} onCommand={command => send(device, command)} />)}
          </div>
        ) : (
          <Glass className={styles.placeholder}>
            <EmptyState icon={<Plus size={24} strokeWidth={1.75} />} title="No devices to show" description="Connect more devices, or show hidden ones from Customize." />
          </Glass>
        )}
      </section>

      <section className={styles.cameras} aria-label="Cameras">
        {Array.from({ length: CAMERA_SLOTS }, (_, index) => cameras[index]).map((camera, index) => camera
          ? <CameraTile key={camera.id} camera={camera} />
          : (
            <Link key={`slot-${index}`} href="/connections#cameras" className={`${glassClass()} ${styles.cameraSlot}`}>
              <Video size={24} strokeWidth={1.75} aria-hidden="true" />
              <span>Add a camera</span>
            </Link>
          ))}
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className={styles.dashboard} aria-busy="true">
      <Skeleton lines={2} label="Loading your home" />
      <div className={styles.top}>
        <Glass className={styles.placeholderSquare}><Skeleton lines={4} /></Glass>
        <div className={styles.devices}>
          {Array.from({ length: 6 }, (_, index) => <Glass key={index} shape="panel" className={styles.skeletonTile}><Skeleton lines={2} avatar /></Glass>)}
        </div>
      </div>
    </div>
  );
}
