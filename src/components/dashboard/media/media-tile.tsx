"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import {
  Bluetooth, Check, ChevronLeft, Headphones, Heart, ListMusic, Music, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Speaker, Tv, Volume1, Volume2, X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { Slider } from "@/components/arc/slider/slider";
import { useHome } from "@/components/dashboard/use-home";
import { useTick } from "@/components/dashboard/household/use-tick";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { paletteFromImage } from "@/components/shell/image-tools";
import { hexToHsl, hslToHex } from "@/lib/backgrounds/palette";
import { clamp, livePosition, type DeviceCommand, type MediaPlayerDevice, type RepeatMode } from "@/lib/devices/types";
import { deleteWidgetItem, saveWidgetItem } from "@/lib/widget-actions";
import { itemsOf } from "@/lib/widgets/items";
import styles from "./media-tile.module.css";

type Send = (command: DeviceCommand) => Promise<void>;
type View = "controls" | "outputs" | "queue";

interface Track {
  title: string;
  artist: string | null;
  media: { id: string; type: string } | null;
}

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
  const tint = useCoverTint(device.artwork);
  const transition = reduce ? { duration: 0 } : motionTokens.spring.morph;
  const send: Send = command => onCommand(command).catch(() => {});
  const look = { "data-tinted": tint ? "" : undefined, "data-playing": device.state === "playing" ? "" : undefined, style: tint ? { "--tint": tint } as CSSProperties : undefined };

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
    return <div className={`${glassClass("panel")} ${styles.tile}`} {...look}><Player device={device} send={send} interactive={interactive} view={view} onView={setView} /></div>;
  }

  return (
    <LayoutGroup id={`media-${tileId}`}>
      {open ? <div className={styles.lifted} aria-hidden="true" /> : (
        <motion.div layoutId="card" className={`${glassClass("panel")} ${styles.tile}`} {...look} style={{ ...look.style, borderRadius: 26 }} transition={transition}>
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
              <motion.div layoutId="card" role="dialog" aria-modal="true" aria-label={`${device.name}, now playing`} className={`${glassSheetClass} ${styles.card}`} {...look} style={{ ...look.style, borderRadius: 30 }} transition={transition}>
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

/** The view lives with the card, so switching views re-renders the card and it resizes on the same spring. */
function Player({ device, send, interactive, view, onView: setView, autoFocus, onCollapse }: { device: MediaPlayerDevice; send: Send; interactive: boolean; view: View; onView: (view: View) => void; autoFocus?: boolean; onCollapse?: () => void }) {
  const titleId = useId();
  const reduce = useReducedMotion();
  const peers = useGroupPeers(device);
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: reduce ? 0 : 0.16 } };
  const canRoute = device.can.output || peers.length > 0;
  const toggle = (next: View) => setView(view === next ? "controls" : next);
  const where = device.group.length > 1 ? `${device.group.length} speakers` : device.output;
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
        <Favourite device={device} disabled={!interactive} />
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {view === "controls" && (
          <motion.div key="controls" className={styles.body} {...fade}>
            <Timeline device={device} send={send} disabled={!interactive} />
            <Controls device={device} send={send} disabled={!interactive} large autoFocus={autoFocus} />
            {device.can.volume && <Volume device={device} send={send} disabled={!interactive} />}
          </motion.div>
        )}
        {view === "outputs" && (
          <motion.div key="outputs" className={styles.body} {...fade}>
            <Outputs device={device} peers={peers} send={send} onDone={() => setView("controls")} />
          </motion.div>
        )}
        {view === "queue" && (
          <motion.div key="queue" className={styles.body} {...fade}>
            <Queue device={device} send={send} disabled={!interactive} onDone={() => setView("controls")} />
          </motion.div>
        )}
      </AnimatePresence>
      <div className={styles.foot}>
        <button type="button" className={styles.footButton} aria-label="Up next, recently played, and favourites" aria-pressed={view === "queue"} disabled={!interactive} onClick={() => toggle("queue")}>
          <ListMusic size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span className={styles.where}>{where && <><OutputIcon name={device.output} size={14} /> {where}</>}</span>
        {canRoute ? (
          <button type="button" className={styles.footButton} aria-label={`Playing on ${where ?? "this player"}. Choose where it plays`} aria-pressed={view === "outputs"} disabled={!interactive} onClick={() => toggle("outputs")}>
            <OutputIcon name={device.output} size={18} />
          </button>
        ) : <span className={styles.footSpacer} aria-hidden="true" />}
      </div>
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

/** The heart saves what is playing, so it can be played again later from any player. */
function Favourite({ device, disabled }: { device: MediaPlayerDevice; disabled: boolean }) {
  const { home } = useHome();
  const [pending, setPending] = useState<boolean | null>(null);
  const media = device.media;
  if (!media || !device.can.play || !device.title) return null;
  const saved = itemsOf(home?.widgets ?? [], "favorite").find(item => item.data.contentId === media.id);
  const on = pending ?? Boolean(saved);
  const toggle = async () => {
    setPending(!on);
    if (saved) await deleteWidgetItem(saved.id);
    else await saveWidgetItem("favorite", { title: device.title, artist: device.artist ?? "", contentId: media.id, contentType: media.type });
    setPending(null);
  };
  return (
    <button type="button" className={styles.heart} data-on={on || undefined} aria-pressed={on} aria-label={on ? `Remove ${device.title} from favourites` : `Add ${device.title} to favourites`} disabled={disabled} onClick={() => void toggle()}>
      <Heart size={18} strokeWidth={1.75} fill={on ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}

const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = { off: "all", all: "one", one: "off" };

function Controls({ device, send, disabled, large, autoFocus }: { device: MediaPlayerDevice; send: Send; disabled: boolean; large?: boolean; autoFocus?: boolean }) {
  const playing = device.state === "playing";
  const lead = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (autoFocus) lead.current?.focus(); }, [autoFocus]);
  const icon = large ? 20 : 16;
  const repeat = device.repeat ?? "off";
  return (
    <motion.span layoutId="ops" layout="position" className={styles.ops} data-large={large || undefined}>
      {large && device.can.shuffle && (
        <button type="button" className={styles.mode} data-on={device.shuffle || undefined} aria-pressed={Boolean(device.shuffle)} aria-label="Shuffle" disabled={disabled} onClick={() => void send({ type: "shuffle", on: !device.shuffle })}>
          <Shuffle size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
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
      {large && device.can.repeat && (
        <button type="button" className={styles.mode} data-on={repeat !== "off" || undefined} aria-pressed={repeat !== "off"} aria-label={repeat === "one" ? "Repeating this track" : repeat === "all" ? "Repeating all" : "Repeat"} disabled={disabled}
          onClick={() => void send({ type: "repeat", mode: NEXT_REPEAT[repeat] })}>
          {repeat === "one" ? <Repeat1 size={16} strokeWidth={1.75} aria-hidden="true" /> : <Repeat size={16} strokeWidth={1.75} aria-hidden="true" />}
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

function ViewHead({ title, onDone }: { title: string; onDone: () => void }) {
  return (
    <div className={styles.viewHead}>
      <button type="button" className={styles.back} aria-label="Back to the controls" onClick={onDone}><ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /></button>
      <span className={styles.viewTitle}>{title}</span>
    </div>
  );
}

/** Where it plays: the player's own outputs, such as Bluetooth devices, and other speakers it can play together with. */
function Outputs({ device, peers, send, onDone }: { device: MediaPlayerDevice; peers: MediaPlayerDevice[]; send: Send; onDone: () => void }) {
  const { send: sendTo } = useHome();
  return (
    <div className={styles.list}>
      <ViewHead title="Play on" onDone={onDone} />
      {device.can.output && (
        <div role="radiogroup" aria-label="Play on" className={styles.rows}>
          {device.outputs.map(output => (
            <button key={output} type="button" role="radio" aria-checked={output === device.output} className={styles.row}
              onClick={() => { void send({ type: "output", output }); onDone(); }}>
              <span className={styles.rowIcon}><OutputIcon name={output} size={16} /></span>
              <span className={styles.rowName}>{output}</span>
              {output === device.output && <Check size={16} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
      {peers.length > 0 && (
        <>
          <span className={styles.groupLabel}>Also play in</span>
          <div className={styles.rows}>
            {peers.map(peer => {
              const joined = device.group.includes(peer.id);
              return (
                <button key={peer.id} type="button" role="checkbox" aria-checked={joined} className={styles.row}
                  onClick={() => void (joined ? sendTo(peer, { type: "unjoin" }).catch(() => {}) : send({ type: "join", members: [peer.id] }))}>
                  <span className={styles.rowIcon}><Speaker size={16} strokeWidth={1.75} aria-hidden="true" /></span>
                  <span className={styles.rowName}>{peer.name}{peer.room && peer.room !== peer.name ? <span className={styles.rowMeta}> · {peer.room}</span> : null}</span>
                  <span className={styles.tick} data-on={joined || undefined} aria-hidden="true">{joined && <Check size={14} strokeWidth={2} />}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {device.can.output && <p className={styles.note}>Pair a Bluetooth speaker or headphones with this player and it shows up here.</p>}
    </div>
  );
}

const fetchJson = <T,>(url: string): Promise<T> => fetch(url).then(response => { if (!response.ok) throw new Error(); return response.json(); });

/** Up next and recently played, from the player, and favourites, saved in Hearth. Any of them with a known source plays again on tap. */
function Queue({ device, send, disabled, onDone }: { device: MediaPlayerDevice; send: Send; disabled: boolean; onDone: () => void }) {
  const { home } = useHome();
  const { data } = useSWR<{ recent: Track[]; next: Track | null }>(`/api/devices/${encodeURIComponent(device.id)}/media?title=${encodeURIComponent(device.title ?? "")}&queue=${device.can.queue ? 1 : 0}`, fetchJson, { refreshInterval: 30_000 });
  const favourites = itemsOf(home?.widgets ?? [], "favorite");
  const play = (track: Track) => { if (track.media && device.can.play) { void send({ type: "playMedia", id: track.media.id, mediaType: track.media.type }); onDone(); } };
  const playable = (track: Track) => Boolean(track.media && device.can.play && !disabled);
  return (
    <div className={styles.list}>
      <ViewHead title="Queue" onDone={onDone} />
      {data?.next && (
        <>
          <span className={styles.groupLabel}>Up next</span>
          <div className={styles.rows}><TrackRow track={data.next} /></div>
        </>
      )}
      <span className={styles.groupLabel}>Recently played</span>
      <div className={styles.rows}>
        {data === undefined ? <p className={styles.note}>Looking back through today…</p>
          : data.recent.length === 0 ? <p className={styles.note}>Nothing else has played today.</p>
          : data.recent.map(track => <TrackRow key={track.title} track={track} onPlay={playable(track) ? () => play(track) : undefined} />)}
      </div>
      <span className={styles.groupLabel}>Favourites</span>
      <div className={styles.rows}>
        {favourites.length === 0 ? <p className={styles.note}>Tap the heart while something plays to keep it here.</p>
          : favourites.map(item => {
            const track = { title: item.data.title, artist: item.data.artist || null, media: { id: item.data.contentId, type: item.data.contentType } };
            return <TrackRow key={item.id} track={track} onPlay={playable(track) ? () => play(track) : undefined} onRemove={disabled ? undefined : () => void deleteWidgetItem(item.id)} />;
          })}
      </div>
    </div>
  );
}

function TrackRow({ track, onPlay, onRemove }: { track: Track; onPlay?: () => void; onRemove?: () => void }) {
  const body = (
    <>
      <span className={styles.rowIcon}>{onPlay ? <Play size={14} strokeWidth={0} fill="currentColor" className={styles.playGlyph} aria-hidden="true" /> : <Music size={14} strokeWidth={1.75} aria-hidden="true" />}</span>
      <span className={styles.rowName}>{track.title}{track.artist && <span className={styles.rowMeta}> · {track.artist}</span>}</span>
    </>
  );
  return (
    <div className={styles.trackRow}>
      {onPlay ? <button type="button" className={styles.row} aria-label={`Play ${track.title}`} onClick={onPlay}>{body}</button> : <div className={styles.row} data-static>{body}</div>}
      {onRemove && <button type="button" className={styles.remove} aria-label={`Remove ${track.title} from favourites`} onClick={onRemove}><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>}
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

/** Other players this one can play together with: same connection, and able to group. */
function useGroupPeers(device: MediaPlayerDevice) {
  const { home } = useHome();
  if (!device.can.group) return [];
  return (home?.devices ?? []).filter((other): other is MediaPlayerDevice => other.kind === "media_player" && other.id !== device.id && other.can.group && other.integrationId === device.integrationId && other.available);
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

const tints = new Map<string, string | null>();
const tintListeners = new Set<() => void>();

/** The cover's most colourful tone, softened to sit behind text; null for grey covers, or until it has loaded. */
function loadTint(src: string) {
  if (tints.has(src)) return;
  tints.set(src, null);
  paletteFromImage(src, 5).then(colors => {
    const vivid = colors.map(hexToHsl).sort((a, b) => b[1] * (1 - Math.abs(b[2] - 0.5)) - a[1] * (1 - Math.abs(a[2] - 0.5)))[0];
    tints.set(src, vivid && vivid[1] > 0.14 ? hslToHex(vivid[0], Math.min(vivid[1], 0.62), 0.58) : null);
    for (const listener of tintListeners) listener();
  }).catch(() => {});
}

function useCoverTint(src: string | null) {
  useEffect(() => { if (src) loadTint(src); }, [src]);
  return useSyncExternalStore(
    listener => { tintListeners.add(listener); return () => tintListeners.delete(listener); },
    () => (src ? tints.get(src) ?? null : null),
    () => null,
  );
}
