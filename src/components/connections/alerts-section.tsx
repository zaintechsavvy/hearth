"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import { Glass } from "@/components/glass/glass";
import type { AlertSettings } from "@/lib/activity-types";
import { saveAlerts } from "@/lib/actions";
import styles from "./connections.module.css";

type DeviceState = "unsupported" | "needs-install" | "blocked" | "off" | "on" | "loading";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

const deviceLabel = () => {
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent) ? "Edge" : /Chrome\//.test(agent) ? "Chrome" : /Firefox\//.test(agent) ? "Firefox" : /Safari\//.test(agent) ? "Safari" : "Browser";
  const system = /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android" : /Mac/.test(agent) ? "Mac" : /Windows/.test(agent) ? "Windows" : "";
  return [browser, system].filter(Boolean).join(" on ");
};

async function currentState(): Promise<DeviceState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return /iPhone|iPad/.test(navigator.userAgent) ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.ready;
  return (await registration.pushManager.getSubscription()) ? "on" : "off";
}

/** Phone and tablet alerts for what matters: the doorbell, leaks and smoke, doors left open, timers, and doses. */
export function AlertsSection({ alerts }: { alerts: AlertSettings }) {
  const [settings, setSettings] = useState(alerts);
  const [device, setDevice] = useState<DeviceState>("loading");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    void currentState().then(setDevice);
  }, []);

  const update = (patch: Partial<AlertSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveAlerts(next);
  };

  const enable = async () => {
    setDevice("loading");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setDevice("blocked");
      const { publicKey } = await (await fetch("/api/push")).json() as { publicKey: string };
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const json = subscription.toJSON();
      await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, label: deviceLabel() }) });
      setDevice("on");
    } catch {
      setNote("This browser could not turn on alerts.");
      setDevice(await currentState());
    }
  };

  const disable = async () => {
    setDevice("loading");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch(`/api/push?endpoint=${encodeURIComponent(subscription.endpoint)}`, { method: "DELETE" });
      await subscription.unsubscribe();
    }
    setDevice("off");
  };

  const test = async () => {
    const { delivered } = await (await fetch("/api/push/test", { method: "POST" })).json() as { delivered: number };
    setNote(delivered ? `Sent to ${delivered} ${delivered === 1 ? "device" : "devices"}.` : "No device has alerts turned on yet.");
  };

  const status: Record<DeviceState, string> = {
    loading: "Checking this device",
    on: "This device gets alerts, even when Hearth is closed.",
    off: "This device does not get alerts yet.",
    blocked: "Notifications are blocked for Hearth in this browser's settings.",
    "needs-install": "On iPhone and iPad, add Hearth to the Home Screen first, then turn alerts on from there.",
    unsupported: "This browser cannot receive alerts.",
  };

  return (
    <section id="alerts" className={styles.section} aria-labelledby="alerts-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="alerts-title" className={styles.sectionTitle}>Alerts</h2>
          <p className={styles.sectionDescription}>Notifications on your phone or tablet. They come from your Hearth server, so it has to be running.</p>
        </div>
      </div>
      <Glass shape="panel" className={styles.group}>
        <div className={styles.row}>
          <BellRing className={styles.rowIcon} size={20} strokeWidth={1.75} aria-hidden="true" />
          <div className={styles.rowText}>
            <span className={styles.rowTitle}>Alerts on this device</span>
            <span className={styles.rowMeta}>{note ?? status[device]}</span>
          </div>
          <div className={styles.rowActions}>
            {device === "on" && <Button variant="ghost" size="sm" onClick={() => void test()}>Send a test</Button>}
            {(device === "on" || device === "off") && (
              <Switch aria-label="Alerts on this device" checked={device === "on"} onCheckedChange={on => void (on ? enable() : disable())} />
            )}
          </div>
        </div>
        <div className={`${styles.row} ${styles.stacked}`}>
          <Switch label="Someone rings the doorbell" checked={settings.doorbell} onCheckedChange={doorbell => update({ doorbell })} />
          <Switch label="A leak or smoke is detected" checked={settings.safety} onCheckedChange={safety => update({ safety })} />
          <Switch label="A lock jams" checked={settings.locks} onCheckedChange={locks => update({ locks })} />
          <Switch label="A timer finishes" checked={settings.timers} onCheckedChange={timers => update({ timers })} />
          <Switch label="A medication dose is due" checked={settings.medications} onCheckedChange={medications => update({ medications })} />
          <Slider label="A door, gate, or garage is left open" value={settings.openMinutes} min={0} max={60} step={5}
            format={value => value === 0 ? "Never" : `After ${value} min`} onValueCommit={openMinutes => update({ openMinutes })} />
        </div>
      </Glass>
    </section>
  );
}
