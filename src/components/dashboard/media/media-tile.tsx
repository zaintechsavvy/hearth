"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Bluetooth, Check, ChevronLeft, Headphones, Music, Pause, Play, SkipBack, SkipForward, Speaker, Tv, Volume1, Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { Slider } from "@/components/arc/slider/slider";
import { useTick } from "@/components/dashboard/household/use-tick";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { clamp, livePosition, type DeviceCommand, type MediaPlayerDevice } from "@/lib/devices/types";
import styles from "./media-tile.module.css";

type Send = (command: DeviceCommand) => Promise<void>;
type View = "controls" | "outputs";

interface MediaTileProps {
  /** The tile's own id, so two tiles of one player each morph on their own. */
  tileId: string;
  device: MediaPlayerDevice;
  /** A bar opens into the full player over the page; a player tile shows it in place. */
  layout: "bar" | "player";
  interactive: boolean;
  onCommand: Send;
}

const subscribeNothing = () => () => {};

/** Now playing, as a bar that opens into the full player and folds back as one. */
export function MediaTile({ tileId, device, layout, interactive, onCommand }: MediaTileProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("controls");
  const reduce = useReducedMotion();
  const client = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const opener = useRef<HTMLButtonElement>(null);
  const transition = reduce ? { duration: 0 } : motionTokens.spring.morph;
  const send: Send = command => onCommand(command).catch(() => {});

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close() {
    setOpen(false);
    setView("controls");
    requestAnimationFrame(() => opener.current?.focus());
  }

  if (layout === "player") {
    return <div className={`${glassClass("panel")} ${styles.tile}`}><Player device={device} send={send} interactive={interactive} view={view} onView={setView} /></div>;
  }

  return (
    <LayoutGroup id={`media-${tileId}`}>
      {open ? <div className={styles.lifted} aria-hidden="true" /> : (
        <motion.div layoutId="card" className={`${glassClass("panel")} ${styles.tile}`} style={{ borderRadius: 26 }} transition={transition}>
          <Bar device={device} send={send} interactive={interactive} opener={opener} onOpen={() => setOpen(true)} />
        </motion.div>
      )}
      {client && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div key="scrim" className={styles.scrim} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }} onClick={close} />
          )}
          {open && (
            <div key="stage" className={styles.stage}>
              <motion.div layoutId="card" role="dialog" aria-modal="true" aria-label={`${device.name}, now playing`} className={`${glassSheetClass} ${styles.card}`} style={{ borderRadius: 30 }} transition={transition}>
                <Player device={device} send={send} interactive={interactive} view={view} onView={setView} autoFocus onCollapse={close} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </LayoutGroup>
  );
}

function Bar({ device, send, interactive, opener, onOpen }: { device: MediaPlayerDevice; send: Send; interactive: boolean; opener: React.RefObject<HTMLButtonElement | null>; onOpen: () => void }) {
  const position = usePosition(device);
  return (
    <div className={styles.bar}>
      <button ref={opener} type="button" className={styles.tap} aria-label={`Open ${device.name}`} aria-expanded={false} disabled={!interactive} onClick={onOpen} />
      <Art device={device} />
      <Text device={device} />
      <Controls device={device} send={send} disabled={!interactive} />
      <Rail position={position} duration={device.duration} />
    </div>
  );
}

/** The view lives with the card, so switching to the outputs re-renders the card and it grows on the same spring. */
function Player({ device, send, interactive, view, onView: setView, autoFocus, onCollapse }: { device: MediaPlayerDevice; send: Send; interactive: boolean; view: View; onView: (view: View) => void; autoFocus?: boolean; onCollapse?: () => void }) {
  const titleId = useId();
  const reduce = useReducedMotion();
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: reduce ? 0 : 0.16 } };
  return (
    <div className={styles.player}>
      <div className={styles.head}>
        {onCollapse ? (
          <button type="button" className={styles.headTap} aria-label="Fold the player back" onClick={onCollapse}>
            <Art device={device} />
            <Text device={device} id={titleId} />
          </button>
        ) : (
          <>
            <Art device={device} />
            <Text device={device} id={titleId} />
          </>
        )}
        {device.can.output && (
          <button type="button" className={styles.outputButton} aria-label={`Playing on ${device.output ?? "this player"}. Choose where it plays`} aria-pressed={view === "outputs"} disabled={!interactive}
            onClick={() => setView(view === "outputs" ? "controls" : "outputs")}>
            <OutputIcon name={device.output} size={18} />
          </button>
        )}
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {view === "controls" ? (
          <motion.div key="controls" className={styles.body} {...fade}>
            <Timeline device={device} send={send} disabled={!interactive} />
            <Controls device={device} send={send} disabled={!interactive} large autoFocus={autoFocus} />
            {device.can.volume && <Volume device={device} send={send} disabled={!interactive} />}
            {device.output && device.can.output && <p className={styles.where}><OutputIcon name={device.output} size={14} /> {device.output}</p>}
          </motion.div>
        ) : (
          <motion.div key="outputs" className={styles.body} {...fade}>
            <Outputs device={device} send={send} onDone={() => setView("controls")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Art({ device }: { device: MediaPlayerDevice }) {
  return (
    <motion.span layoutId="art" className={styles.art} aria-hidden="true">
      <Music size={18} strokeWidth={1.75} />
      {device.artwork && <span className={styles.cover} style={{ backgroundImage: `url("${device.artwork}")` }} />}
    </motion.span>
  );
}

function Text({ device, id }: { device: MediaPlayerDevice; id?: string }) {
  const title = device.title ?? (device.state === "off" ? "Off" : "Nothing playing");
  const by = device.title ? device.artist : device.output ?? device.name;
  return (
    <motion.span layoutId="text" layout="position" className={styles.text}>
      <span id={id} className={styles.title}>{title}</span>
      {by && <span className={styles.by}>{by}</span>}
    </motion.span>
  );
}

function Controls({ device, send, disabled, large, autoFocus }: { device: MediaPlayerDevice; send: Send; disabled: boolean; large?: boolean; autoFocus?: boolean }) {
  const playing = device.state === "playing";
  const lead = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (autoFocus) lead.current?.focus(); }, [autoFocus]);
  const icon = large ? 20 : 16;
  return (
    <motion.span layoutId="ops" layout="position" className={styles.ops} data-large={large || undefined}>
      {device.can.previous && (
        <button type="button" className={styles.op} data-side aria-label="Previous" disabled={disabled} onClick={() => void send({ type: "media", action: "previous" })}>
          <SkipBack size={icon} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
      <button ref={lead} type="button" className={styles.op} data-lead aria-label={playing ? "Pause" : "Play"} disabled={disabled} onClick={() => void send({ type: "media", action: playing ? "pause" : "play" })}>
        {playing ? <Pause size={icon} strokeWidth={0} fill="currentColor" aria-hidden="true" /> : <Play size={icon} strokeWidth={0} fill="currentColor" className={styles.playGlyph} aria-hidden="true" />}
      </button>
      {device.can.next && (
        <button type="button" className={styles.op} data-side aria-label="Next" disabled={disabled} onClick={() => void send({ type: "media", action: "next" })}>
          <SkipForward size={icon} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </motion.span>
  );
}

function Rail({ position, duration }: { position: number | null; duration: number | null }) {
  if (position === null || !duration) return null;
  return (
    <motion.span layoutId="rail" className={styles.rail} aria-hidden="true">
      <span className={styles.run} style={{ width: `${clamp(position / duration, 0, 1) * 100}%` }} />
    </motion.span>
  );
}

/** The rail with its clock. Where the player allows it, a press or a drag on the rail moves through the track. */
function Timeline({ device, send, disabled }: { device: MediaPlayerDevice; send: Send; disabled: boolean }) {
  const live = usePosition(device);
  const [scrub, setScrub] = useState<number | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const { duration } = device;
  if (live === null || !duration) return null;
  const shown = scrub ?? live;
  const seekable = device.can.seek && !disabled;
  const at = (event: PointerEvent) => {
    const box = rail.current?.getBoundingClientRect();
    return box ? clamp((event.clientX - box.left) / box.width, 0, 1) * duration : shown;
  };
  const commit = (seconds: number) => { setScrub(seconds); void send({ type: "seek", position: Math.round(seconds) }).finally(() => setScrub(null)); };
  const key = (event: KeyboardEvent) => {
    const step = event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : null;
    if (step === null) return;
    event.preventDefault();
    commit(clamp(shown + step, 0, duration));
  };
  return (
    <div className={styles.timeline}>
      <div ref={rail} className={styles.scrubber} data-seekable={seekable || undefined}
        role={seekable ? "slider" : undefined} tabIndex={seekable ? 0 : undefined} aria-label={seekable ? "Position in track" : undefined}
        aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(shown)} aria-valuetext={`${clock(shown)} of ${clock(duration)}`}
        onPointerDown={seekable ? event => { event.currentTarget.setPointerCapture(event.pointerId); setScrub(at(event)); } : undefined}
        onPointerMove={seekable ? event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setScrub(at(event)); } : undefined}
        onPointerUp={seekable ? event => commit(at(event)) : undefined}
        onKeyDown={seekable ? key : undefined}>
        <Rail position={shown} duration={duration} />
      </div>
      <span className={styles.clock} aria-hidden="true"><span>{clock(shown)}</span><span>−{clock(duration - shown)}</span></span>
    </div>
  );
}

function Volume({ device, send, disabled }: { device: MediaPlayerDevice; send: Send; disabled: boolean }) {
  const [draft, setDraft] = useState<number | null>(null);
  return (
    <div className={styles.volume}>
      <Slider label="Volume" value={draft ?? device.volume ?? 0} min={0} max={100} showValue={false} disabled={disabled} format={value => `${value}%`}
        start={<Volume1 size={16} strokeWidth={1.75} aria-hidden="true" />} end={<Volume2 size={16} strokeWidth={1.75} aria-hidden="true" />}
        onValueChange={setDraft} onValueCommit={value => { setDraft(value); void send({ type: "volume", value }).finally(() => setDraft(null)); }} />
    </div>
  );
}

function Outputs({ device, send, onDone }: { device: MediaPlayerDevice; send: Send; onDone: () => void }) {
  return (
    <div className={styles.outputs}>
      <div className={styles.outputsHead}>
        <button type="button" className={styles.back} aria-label="Back to the controls" onClick={onDone}><ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /></button>
        <span className={styles.outputsTitle}>Play on</span>
      </div>
      <div role="radiogroup" aria-label="Play on" className={styles.outputList}>
        {device.outputs.map(output => (
          <button key={output} type="button" role="radio" aria-checked={output === device.output} className={styles.output}
            onClick={() => { void send({ type: "output", output }); onDone(); }}>
            <span className={styles.outputIcon}><OutputIcon name={output} size={16} /></span>
            <span className={styles.outputName}>{output}</span>
            {output === device.output && <Check size={16} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <p className={styles.note}>Pair a Bluetooth speaker or headphones with this player and it shows up here.</p>
    </div>
  );
}

function OutputIcon({ name, size }: { name: string | null; size: number }) {
  const Icon = !name ? Speaker
    : /airpods|buds|headphone|headset|beats/i.test(name) ? Headphones
    : /bluetooth|soundlink|\bbt\b|jbl|boom|soundcore/i.test(name) ? Bluetooth
    : /\btv\b|television/i.test(name) ? Tv
    : Speaker;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

/** Where the track is now, moving once a second while it plays. */
function usePosition(device: MediaPlayerDevice) {
  const now = useTick(device.state === "playing" ? 1000 : 60_000);
  return now === null ? device.position : livePosition(device, now);
}

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};
