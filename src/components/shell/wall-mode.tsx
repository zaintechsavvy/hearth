"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, DoorOpen, History, House, Leaf, LogOut, MonitorPause, Moon, MoreHorizontal, Package, Paintbrush, Pill, Recycle, Settings, Sparkles, Thermometer } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import useSWR from "swr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { askHearth } from "@/components/assistant/assistant-dock";
import { useHome } from "@/components/dashboard/use-home";
import { useTick } from "@/components/dashboard/household/use-tick";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { haptic } from "@/lib/haptics";
import { WAKE_EVENT } from "@/components/dashboard/doorbell-call";
import { startBedtime } from "@/components/shell/bedtime-check";
import { LeftOpenBanner, leftOpenWords, useLeftOpen, type LeftOpen } from "@/components/shell/left-open";
import { PhotoFrame } from "@/components/shell/photo-frame";
import { StateNotices } from "@/components/shell/state-notice";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { isDark } from "@/lib/left-open";
import { isWidget, type TileConfig } from "@/lib/dashboard/layout";
import { AnalogFace } from "./analog-face";
import { LuxuryFace } from "./luxury-face";
import { DigitalTime } from "./digital-time";
import { clockColorOf, DEFAULT_WALL, isNight, WALL_KEY, type WallSettings } from "@/lib/wall";
import type { Agenda } from "@/lib/widgets/calendar";
import { itemsOf } from "@/lib/widgets/items";
import { doseSlots, groupPickups, pickupWords, timerColors, timerRemaining, formatDuration } from "@/lib/widgets/schedules";
import { skyWords } from "@/lib/widgets/weather-codes";
import type { Forecast } from "@/lib/widgets/weather";
import { RestActivity } from "./rest-activity";
import styles from "./wall-mode.module.css";

const SHIFT_EVERY_MS = 10 * 60_000;
const SHIFT_PX = 4;
const DRIFT_EVERY_MS = 60_000;
const NIGHT_RED = "oklch(52% 0.16 25)";
const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
/** How long a finger rests on the wallpaper before the page shrinks to the quick actions. */
const OVERVIEW_HOLD_MS = 550;
const OVERVIEW_SLOP_PX = 10;
/** What counts as a control rather than the wallpaper: holding one of these never opens the quick actions. */
const NOT_BACKGROUND = "button, a, input, textarea, select, label, [role=button], [role=slider], [role=switch], [role=radio], [role=checkbox], [data-tile], [data-radix-popper-content-wrapper], [role=dialog]";

const fetchJson = <T,>(url: string): Promise<T> => fetch(url).then(response => { if (!response.ok) throw new Error(); return response.json(); });

/** Wall tablet mode, on this device only: keeps the screen on, dims at night, rests on a glanceable screensaver, and wakes on touch or motion. */
export function WallMode() {
  const [stored, setStored] = useStoredJson<WallSettings>(WALL_KEY, DEFAULT_WALL);
  const settings = { ...DEFAULT_WALL, ...stored };
  useEffect(() => {
    const root = document.documentElement;
    if (settings.enabled) root.dataset.wall = settings.showAssistant ? "assistant" : "";
    else delete root.dataset.wall;
    return () => { delete root.dataset.wall; };
  }, [settings.enabled, settings.showAssistant]);
  return settings.enabled ? <Wall settings={settings} onLeave={() => setStored({ ...settings, enabled: false })} /> : null;
}

/** The header is hidden on a wall tablet, so its menu carries the way around the app and out of wall tablet mode. */
const PAGES = [{ href: "/dashboard", label: "Home", icon: House }, { href: "/activity", label: "Activity", icon: History }, { href: "/settings", label: "Settings", icon: Settings }];

function Wall({ settings, onLeave }: { settings: WallSettings; onLeave: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { home, send } = useHome();
  // The wall only needs a coarse clock for resting and the corner time; the resting screen ticks every second on its own.
  const now = useTick(5000) ?? 0;
  const [resting, setResting] = useState(false);
  /** When the screen last went to rest, so its activity notes show only what happened since. */
  const [restedAt, setRestedAt] = useState(0);
  const [menu, setMenu] = useState(false);
  const [overview, setOverview] = useState(false);
  const lastActive = useRef(0);
  const wasResting = useRef(false);
  const sensorState = useRef<Map<string, boolean>>(new Map());
  const night = now > 0 && isNight(settings, new Date(now));
  const dark = now > 0 && isDark(new Date(now), home?.sun ?? null, night);
  const leftOpen = useLeftOpen(home?.devices, now, home?.sun ?? null, night, settings.openMinutes, settings.openReminder);

  useEffect(() => {
    lastActive.current = Date.now();
    const wake = () => {
      lastActive.current = Date.now();
      setResting(false);
      // A touch tablet goes full screen at the first tap, since browsers only allow it from a tap.
      if (!document.fullscreenElement && matchMedia("(pointer: coarse)").matches) void document.documentElement.requestFullscreen?.().catch(() => {});
    };
    for (const type of ACTIVITY) window.addEventListener(type, wake, { passive: true });
    window.addEventListener(WAKE_EVENT, wake);
    return () => {
      for (const type of ACTIVITY) window.removeEventListener(type, wake);
      window.removeEventListener(WAKE_EVENT, wake);
    };
  }, []);

  useEffect(() => {
    if (!settings.idleMinutes || resting || !now) return;
    if (now - lastActive.current >= settings.idleMinutes * 60_000) {
      setResting(true);
      setRestedAt(now);
    }
  }, [now, resting, settings.idleMinutes]);

  useEffect(() => {
    for (const device of home?.devices ?? []) {
      if (!settings.wakeSensors.includes(device.id) || device.kind !== "binary_sensor") continue;
      const was = sensorState.current.get(device.id);
      sensorState.current.set(device.id, device.active);
      if (was === false && device.active) {
        lastActive.current = Date.now();
        setResting(false);
      }
    }
  }, [home?.devices, settings.wakeSensors]);

  // Waking always lands on Home, so a tablet left on Settings greets the next person with the dashboard. It goes
  // there as the screen rests, out of sight, so a tap does not show the old page first.
  useEffect(() => {
    if ((resting || wasResting.current) && !path.startsWith("/dashboard")) router.replace("/dashboard");
    wasResting.current = resting;
  }, [resting, path, router]);

  useEffect(() => {
    if (!settings.keepAwake || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => {
      if (document.visibilityState === "visible") void navigator.wakeLock.request("screen").then(sentinel => { lock = sentinel; }).catch(() => {});
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, [settings.keepAwake]);

  useEffect(() => {
    const root = document.documentElement;
    const shift = () => {
      root.style.setProperty("--wall-shift-x", `${Math.round((Math.random() * 2 - 1) * SHIFT_PX)}px`);
      root.style.setProperty("--wall-shift-y", `${Math.round((Math.random() * 2 - 1) * SHIFT_PX)}px`);
    };
    shift();
    const timer = setInterval(shift, SHIFT_EVERY_MS);
    return () => {
      clearInterval(timer);
      root.style.removeProperty("--wall-shift-x");
      root.style.removeProperty("--wall-shift-y");
    };
  }, []);

  // Holding the wallpaper, not a tile, shrinks the page like a watch face and offers the quick actions underneath.
  useEffect(() => {
    if (!path.startsWith("/dashboard") || resting || overview) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let from: { x: number; y: number } | null = null;
    const cancel = () => { clearTimeout(timer); from = null; };
    const down = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!event.isPrimary || !target?.closest("main") || target.closest(NOT_BACKGROUND)) return;
      from = { x: event.clientX, y: event.clientY };
      timer = setTimeout(() => { from = null; haptic("press"); setMenu(false); setOverview(true); }, OVERVIEW_HOLD_MS);
    };
    const move = (event: PointerEvent) => {
      if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > OVERVIEW_SLOP_PX) cancel();
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    return () => {
      cancel();
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [path, resting, overview]);

  useEffect(() => {
    const root = document.documentElement;
    if (overview) root.dataset.overview = "";
    else delete root.dataset.overview;
    if (!overview) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setOverview(false);
    window.addEventListener("keydown", close);
    return () => { delete root.dataset.overview; window.removeEventListener("keydown", close); };
  }, [overview]);

  const rest = () => { setResting(true); setRestedAt(now); };
  const leave = () => { void document.exitFullscreen?.().catch(() => {}); onLeave(); };
  const actions = [
    { label: "Customize", icon: Paintbrush, run: () => router.push("/settings#wall") },
    { label: "Settings", icon: Settings, run: () => router.push("/settings") },
    ...(settings.showAssistant ? [{ label: "Ask Hearth", icon: Sparkles, run: () => askHearth() }] : []),
    { label: "Good night", icon: Moon, run: () => startBedtime() },
    { label: "Rest the screen", icon: MonitorPause, run: rest },
    { label: "Leave wall mode", icon: LogOut, run: leave },
  ];

  return (
    <>
      <div className={styles.dim} style={{ opacity: night && !resting ? settings.dimLevel : 0 }} aria-hidden="true" />
      <AnimatePresence>
        {overview && (
          <motion.div key="overview" className={styles.overview} role="dialog" aria-modal="true" aria-label="Quick actions"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}>
            <button type="button" className={styles.overviewBack} onClick={() => setOverview(false)} aria-label="Back to the home" />
            <motion.nav className={styles.overviewActions} aria-label="Quick actions"
              initial={reduce ? false : { y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: 24, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34, delay: 0.04 }}>
              {actions.map(({ label, icon: Icon, run }) => (
                <button key={label} type="button" className={styles.overviewAction} onClick={() => { setOverview(false); run(); }}>
                  <span className={`${glassClass("pill")} ${styles.overviewIcon}`}><Icon size={24} strokeWidth={1.75} aria-hidden="true" /></span>
                  <span className={styles.overviewLabel}>{label}</span>
                </button>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {resting && (
          <motion.button type="button" key="saver" className={styles.saver} data-night={night || undefined} data-red={(night && settings.nightRed) || undefined} aria-label="Wake the screen"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.6 }}
            onClick={() => { lastActive.current = Date.now(); setResting(false); }}>
            <Glance night={night} settings={settings} leftOpen={leftOpen.items} />
            <RestActivity since={restedAt} />
          </motion.button>
        )}
      </AnimatePresence>
      {resting && dark && (
        <button type="button" className={styles.bedtime} data-red={(night && settings.nightRed) || undefined}
          onPointerDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
          onClick={() => { lastActive.current = Date.now(); setResting(false); startBedtime(); }}>
          <Moon size={18} strokeWidth={1.75} aria-hidden="true" /> Good night
        </button>
      )}
      <StateNotices devices={home?.devices} />
      {!resting && <LeftOpenBanner items={leftOpen.items} onClose={device => void send(device, { type: "cover", action: "close" }).catch(() => {})} onQuiet={leftOpen.quietTonight} />}
      <div className={styles.corner} data-on-wall>
        {now > 0 && path.startsWith("/dashboard") && <time className={styles.cornerTime} dateTime={new Date(now).toISOString()}>{new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time>}
      <Popover open={menu} onOpenChange={setMenu}>
        <PopoverTrigger asChild>
          <button type="button" className={`${glassClass("pill")} ${styles.menu}`} aria-label="Wall tablet options"><MoreHorizontal size={18} strokeWidth={1.75} aria-hidden="true" /></button>
        </PopoverTrigger>
        <PopoverContent align="end" className={`${glassSheetClass} ${styles.menuContent}`}>
          <nav aria-label="Pages" className={styles.pages}>
            {PAGES.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={styles.page} aria-current={path.startsWith(href) ? "page" : undefined} onClick={() => setMenu(false)}>
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />{label}
              </Link>
            ))}
          </nav>
          <span className={styles.menuDivider} aria-hidden="true" />
          {settings.showAssistant && <button type="button" className={styles.menuItem} onClick={() => { setMenu(false); askHearth(); }}>Ask Hearth</button>}
          <button type="button" className={styles.menuItem} onClick={() => { setMenu(false); startBedtime(); }}>Good night</button>
          <button type="button" className={styles.menuItem} onClick={() => { setMenu(false); rest(); }}>Rest the screen</button>
          <span className={styles.menuDivider} aria-hidden="true" />
          <button type="button" className={styles.menuItem} onClick={() => { setMenu(false); leave(); }}>Leave wall tablet mode</button>
        </PopoverContent>
      </Popover>
      </div>
    </>
  );
}

/** The resting screen: the date over a large clock, the weather, then running timers and what needs doing next as cards. It drifts a little each minute so nothing burns in. */
function Glance({ night, settings, leftOpen }: { night: boolean; settings: WallSettings; leftOpen: LeftOpen[] }) {
  const now = useTick(1000) ?? 0;
  const { home } = useHome();
  const [frameEmpty, setFrameEmpty] = useState(false);
  const photos = settings.frame && !(night && !settings.frameAtNight);
  const date = new Date(now || 0);
  const drift = Math.floor(now / DRIFT_EVERY_MS);
  const red = night && settings.nightRed;
  const brightness = settings.clockBrightness * (night ? 1 - settings.dimLevel * 0.6 : 1);
  const offset = {
    "--drift-x": `${((drift * 37) % 41) - 20}px`,
    "--drift-y": `${((drift * 53) % 31) - 15}px`,
    "--saver-dim": brightness,
    color: red ? undefined : clockColorOf(settings),
  } as CSSProperties;
  const tiles = home?.pages.flatMap(page => page.layout).filter((tile): tile is TileConfig => "kind" in tile && tile.kind !== undefined && isWidget(tile.kind)) ?? [];
  const place = tiles.find(tile => tile.kind === "weather" && tile.options?.place)?.options;
  const { data: weather } = useSWR<Forecast>(place?.place ? `/api/weather?lat=${place.place.latitude}&lon=${place.place.longitude}` : null, fetchJson, { refreshInterval: 10 * 60_000 });
  const { data: agenda } = useSWR<Agenda>(tiles.some(tile => tile.kind === "calendar") ? "/api/calendar" : null, fetchJson, { refreshInterval: 5 * 60_000 });

  const notes: { icon: ReactNode; text: string; key: string }[] = leftOpen.map(item => ({ key: `open-${item.device.id}`, icon: <DoorOpen size={18} strokeWidth={1.75} />, text: leftOpenWords(item) }));
  const widgets = home?.widgets ?? [];
  const timers = itemsOf(widgets, "timer").filter(item => item.data.endsAt && timerRemaining(item.data, now) > 0)
    .sort((a, b) => timerRemaining(a.data, now) - timerRemaining(b.data, now)).slice(0, 3);
  const colors = timerColors(timers);
  // A note only for a widget still on a page: removing the bins tile ends the bin-day reminders, though its bins are kept.
  const shown = new Set(tiles.map(tile => tile.kind));
  const pickup = shown.has("bins") ? groupPickups(itemsOf(widgets, "bin"), date)[0] : undefined;
  if (pickup && pickup.days <= 1) notes.push({ key: "bins", icon: <Recycle size={18} strokeWidth={1.75} />, text: `${pickup.bins.map(bin => bin.data.name).join(" and ")} · ${pickupWords(pickup.days, date)}` });
  const dose = !shown.has("medications") ? undefined : itemsOf(widgets, "medication").flatMap(item => doseSlots(item.data, date, item.createdAt).filter(slot => slot.state === "due" || slot.state === "upcoming").map(slot => ({ item, slot })))
    .sort((a, b) => a.slot.at.getTime() - b.slot.at.getTime())[0];
  if (dose) notes.push({ key: "dose", icon: <Pill size={18} strokeWidth={1.75} />, text: `${dose.item.data.name}${dose.item.data.person ? ` for ${dose.item.data.person}` : ""} at ${dose.slot.at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` });
  const next = agenda?.events.find(event => event.allDay ? event.start >= date.toISOString().slice(0, 10) : Date.parse(event.end) > now);
  if (next) notes.push({ key: "event", icon: <CalendarDays size={18} strokeWidth={1.75} />, text: `${next.title} · ${next.allDay ? "all day" : new Date(next.start).toLocaleTimeString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}` });
  const thirsty = !shown.has("plants") ? 0 : itemsOf(widgets, "plant").filter(item => now - Date.parse(item.data.lastWatered) >= item.data.everyDays * 86_400_000).length;
  if (thirsty) notes.push({ key: "plants", icon: <Leaf size={18} strokeWidth={1.75} />, text: `${thirsty} ${thirsty === 1 ? "plant needs" : "plants need"} water` });
  const waiting = !shown.has("packages") ? [] : itemsOf(widgets, "package").filter(item => item.data.status === "delivered");
  if (waiting.length) notes.push({ key: "packages", icon: <Package size={18} strokeWidth={1.75} />, text: waiting.length === 1 ? `${waiting[0].data.name} is here, collect it` : `${waiting.length} packages to collect` });

  if (settings.clockFace !== "digital" && !photos) {
    return (
      <>
        <span style={offset} className={styles.analog}>
          {settings.clockFace === "luxury" ? <LuxuryFace night={night} settings={settings} /> : <AnalogFace night={night} settings={settings} note={notes[0]?.text ?? null} />}
        </span>
        <span className={styles.hint}>Touch to wake</span>
      </>
    );
  }

  return (
    <>
      {photos && <PhotoFrame source={settings.frameSource} seconds={settings.frameSeconds} onEmpty={setFrameEmpty} />}
      <span className={styles.glance} style={offset} data-frame={(photos && !frameEmpty) || undefined} data-align={settings.frameClock}>
        <span className={styles.date}>{now ? date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}</span>
        <DigitalTime now={now} settings={settings} className={styles.clock} />
        {weather && (
          <span className={styles.weather}>
            <Thermometer size={20} strokeWidth={1.75} aria-hidden="true" />
            {Math.round(place?.units === "F" ? weather.current.temperature * 9 / 5 + 32 : weather.current.temperature)}° · {skyWords(weather.current.code, weather.current.day)}
          </span>
        )}
        {(timers.length > 0 || notes.length > 0) && (
          <span className={styles.cards} data-night={night || undefined}>
            {timers.map(timer => {
              const left = timerRemaining(timer.data, now);
              return (
                <span key={timer.id} className={`${styles.card} ${styles.timer}`} style={{ "--timer": red ? NIGHT_RED : timers.length > 1 ? colors.get(timer.id) : "currentColor" } as CSSProperties}>
                  <svg className={styles.timerRing} viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="42" pathLength={100} className={styles.timerTrack} />
                    <circle cx="50" cy="50" r="42" pathLength={100} className={styles.timerProgress} strokeDasharray="100" strokeDashoffset={100 - (left / timer.data.durationMs) * 100} />
                  </svg>
                  <span className={styles.timerText}>
                    <span className={styles.timerTime}>{formatDuration(left)}</span>
                    <span className={styles.cardLabel}>{timer.data.label}</span>
                  </span>
                </span>
              );
            })}
            {notes.slice(0, Math.max(0, 4 - timers.length)).map(note => (
              <span key={note.key} className={styles.card}>
                <span className={styles.noteIcon} aria-hidden="true">{note.icon}</span>
                <span className={styles.noteText}>{note.text}</span>
              </span>
            ))}
          </span>
        )}
      </span>
      <span className={styles.hint}>Touch to wake</span>
    </>
  );
}
