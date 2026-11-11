"use client";

import { Moon, ShieldCheck, ShieldOff, Siren, Sun, Plane, House } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { HoldToConfirm } from "@/components/arc/hold-to-confirm/hold-to-confirm";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { ALARM_TEXT } from "@/lib/devices/status";
import type { AlarmDevice, ArmMode, DeviceCommand } from "@/lib/devices/types";
import type { OpenMethod } from "@/lib/security-types";
import { PinPad } from "../pin-pad";
import { useHome } from "../use-home";
import styles from "./device-tiles.module.css";

type Send = (command: DeviceCommand, pin?: string) => Promise<void>;

const MODE_LABELS: Record<ArmMode, string> = { home: "Home", away: "Away", night: "Night", vacation: "Vacation" };
const MODE_ICONS = { home: House, away: Sun, night: Moon, vacation: Plane };

const armed = (device: AlarmDevice) => device.state !== "disarmed";
const errorOf = (cause: unknown) => cause instanceof Error ? cause.message : "The alarm did not answer.";

/**
 * The alarm: its state at a glance (light red while disarmed, green while armed), the next thing to do on the right,
 * and disarming behind the alarm's own code or the household's confirm.
 */
export function AlarmTile({ device, config, interactive, openMethod, onCommand }: { device: AlarmDevice; config: TileConfig; interactive: boolean; openMethod: OpenMethod; onCommand: Send }) {
  const [open, setOpen] = useState<ArmMode | "disarm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = !interactive || !device.available;
  const name = config.label?.trim() || device.name;
  const arm = (mode: ArmMode) => {
    if (device.codeToArm) return setOpen(mode);
    setError(null);
    void onCommand({ type: "alarm", action: "arm", mode }).catch(cause => setError(errorOf(cause)));
  };
  const Icon = device.state === "triggered" ? Siren : armed(device) ? ShieldCheck : ShieldOff;
  const next = () => armed(device) ? setOpen("disarm") : device.modes.length === 1 ? arm(device.modes[0]) : setOpen("home");
  return (
    <>
      <section className={`${glassClass("panel")} ${styles.card} ${styles.alarm}`} data-size={config.size} data-armed={(armed(device) && device.state !== "triggered") || undefined} data-open={!armed(device) || undefined}
        data-alert={device.state === "triggered" || undefined} aria-label={`${name}, ${ALARM_TEXT[device.state]}`}>
        <div className={styles.alarmRow}>
          <button type="button" className={styles.head} disabled={disabled} onClick={next}>
            <span className={styles.badge} aria-hidden="true"><Icon size={20} strokeWidth={1.75} /></span>
            <span className={styles.text}>
              <span className={styles.name}>{name}</span>
              <span className={styles.meta}>{error ?? ALARM_TEXT[device.state]}</span>
            </span>
          </button>
          {config.size === "2x1" && (
            <button type="button" className={styles.alarmAction} data-lead={armed(device) || undefined} disabled={disabled} onClick={next}>
              {armed(device) ? "Disarm" : "Arm"}
            </button>
          )}
        </div>
        {config.size === "2x3" && <AlarmKeypad device={device} openMethod={openMethod} disabled={disabled} onCommand={onCommand} onArm={arm} />}
        {config.size === "2x2" && (
          <div className={styles.actions}>
            {armed(device)
              ? <button type="button" className={styles.pill} data-lead disabled={disabled} onClick={() => setOpen("disarm")}><ShieldOff size={16} strokeWidth={1.75} aria-hidden="true" />Disarm</button>
              : device.modes.map(mode => {
                const ModeIcon = MODE_ICONS[mode];
                return <button key={mode} type="button" className={styles.pill} disabled={disabled} onClick={() => arm(mode)}><ModeIcon size={16} strokeWidth={1.75} aria-hidden="true" />{MODE_LABELS[mode]}</button>;
              })}
          </div>
        )}
      </section>
      {open && <AlarmDialog device={device} target={open} openMethod={openMethod} onCommand={onCommand} onArm={arm} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The keypad laid into the tile: disarm with the alarm's code or the household PIN, or arm by mode, without a dialog in between. */
function AlarmKeypad({ device, openMethod, disabled, onCommand, onArm }: { device: AlarmDevice; openMethod: OpenMethod; disabled: boolean; onCommand: Send; onArm: (mode: ArmMode) => void }) {
  const pinLength = useHome().home?.pinLength;
  const [mode, setMode] = useState<ArmMode>(device.modes[0] ?? "away");
  const [held, setHeld] = useState(false);
  const send = (command: DeviceCommand, pin?: string) => onCommand(command, pin).then(() => null, errorOf);
  const armedNow = armed(device);
  const pad = armedNow
    ? device.codeFormat ? <PinPad fill label="Alarm code" submitLabel="Disarm" text={device.codeFormat === "text"} onSubmit={code => send({ type: "alarm", action: "disarm", code })} />
      : openMethod === "pin" ? <PinPad fill label="Household PIN" submitLabel="Disarm" length={pinLength} onSubmit={pin => send({ type: "alarm", action: "disarm" }, pin)} />
      : <HoldToConfirm label="Hold to disarm" confirmedLabel="Disarming" tone="neutral" duration={1000} confirmed={held} icon={<ShieldOff size={18} strokeWidth={1.75} />}
        onConfirm={() => { setHeld(true); void send({ type: "alarm", action: "disarm" }).finally(() => setHeld(false)); }} />
    : device.codeToArm ? <PinPad fill label="Alarm code" submitLabel="Arm" text={device.codeFormat === "text"} onSubmit={code => send({ type: "alarm", action: "arm", mode, code })} />
      : null;
  return (
    <div className={styles.keypad} inert={disabled || undefined}>
      {!armedNow && (
        <div className={styles.actions} role="radiogroup" aria-label="Arm for">
          {device.modes.map(item => {
            const ModeIcon = MODE_ICONS[item];
            return (
              <button key={item} type="button" role={device.codeToArm ? "radio" : undefined} aria-checked={device.codeToArm ? mode === item : undefined} className={styles.pill} data-lead={(device.codeToArm && mode === item) || undefined}
                onClick={() => (device.codeToArm ? setMode(item) : onArm(item))}>
                <ModeIcon size={16} strokeWidth={1.75} aria-hidden="true" />{MODE_LABELS[item]}
              </button>
            );
          })}
        </div>
      )}
      {pad}
      {(armedNow || device.codeToArm) && openMethod === "pin" && !device.codeFormat && <Link href="/settings#security" className={styles.keypadLink}>{pinLength ? "Change the household PIN" : "Set a household PIN"}</Link>}
    </div>
  );
}

function AlarmDialog({ device, target, openMethod, onCommand, onArm, onClose }: { device: AlarmDevice; target: ArmMode | "disarm"; openMethod: OpenMethod; onCommand: Send; onArm: (mode: ArmMode) => void; onClose: () => void }) {
  const [held, setHeld] = useState(false);
  const pinLength = useHome().home?.pinLength;
  const send = (command: DeviceCommand, pin?: string) => onCommand(command, pin).then(() => { onClose(); return null; }, errorOf);
  if (target !== "disarm") {
    if (device.codeToArm) {
      return (
        <Dialog open onOpenChange={next => !next && onClose()}>
          <DialogContent className={glassSheetClass} title={`Arm ${device.name}, ${MODE_LABELS[target].toLowerCase()}`} description="Enter the alarm's code.">
            <PinPad label="Alarm code" submitLabel="Arm" text={device.codeFormat === "text"} onSubmit={code => send({ type: "alarm", action: "arm", mode: target, code })} />
          </DialogContent>
        </Dialog>
      );
    }
    return (
      <Dialog open onOpenChange={next => !next && onClose()}>
        <DialogContent className={glassSheetClass} title={`Arm ${device.name}`} description="Pick how it should guard the home.">
          <div className={styles.modes}>
            {device.modes.map(mode => {
              const ModeIcon = MODE_ICONS[mode];
              return <button key={mode} type="button" className={styles.mode} onClick={() => { onArm(mode); onClose(); }}><ModeIcon size={22} strokeWidth={1.75} aria-hidden="true" />{MODE_LABELS[mode]}</button>;
            })}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  const title = `Disarm ${device.name}?`;
  return (
    <Dialog open onOpenChange={next => !next && onClose()}>
      <DialogContent className={glassSheetClass} title={title} description={`${ALARM_TEXT[device.state]}. ${device.codeFormat ? "Enter the alarm's code." : openMethod === "pin" ? "Enter the household PIN." : "Hold the button to disarm."}`}>
        {device.codeFormat ? <PinPad label="Alarm code" submitLabel="Disarm" text={device.codeFormat === "text"} onSubmit={code => send({ type: "alarm", action: "disarm", code })} />
          : openMethod === "pin" ? <PinPad label="Household PIN" submitLabel="Disarm" length={pinLength} onSubmit={pin => send({ type: "alarm", action: "disarm" }, pin)} />
          : (
            <div className={styles.holdRow}>
              <HoldToConfirm label="Hold to disarm" confirmedLabel="Disarming" tone="neutral" duration={1000} confirmed={held} icon={<ShieldOff size={18} strokeWidth={1.75} />}
                onConfirm={() => { setHeld(true); void send({ type: "alarm", action: "disarm" }); }} autoFocus />
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
