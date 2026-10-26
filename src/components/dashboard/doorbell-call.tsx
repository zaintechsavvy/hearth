"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BellRing, Mic, MicOff, Volume2, VolumeX, VideoOff, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import type { EventDevice } from "@/lib/devices/types";
import { haptic } from "@/lib/haptics";
import { cameraFor } from "@/lib/ring-camera";
import { IntegrationCameraTile } from "./integration-camera-tile";
import { useHome } from "./use-home";
import styles from "./doorbell-call.module.css";

/** Wakes a resting wall tablet, so the call is not hidden behind the clock. */
export const WAKE_EVENT = "hearth-wake";
const LOOK_EVENT = "hearth-look-at-door";
/** Opens the doorbell's view without a ring, to see who is there or talk to them. */
export const lookAtDoor = (deviceId: string) => window.dispatchEvent(new CustomEvent(LOOK_EVENT, { detail: deviceId }));
const FRESH_MS = 60_000;
/** A call nobody answers closes by itself. */
const UNANSWERED_MS = 90_000;

/**
 * A doorbell ring that arrives while Hearth is open, on any page: the screen flashes, the doorbell's camera plays,
 * and Listen and Talk carry sound both ways when the camera can. Hearth also keeps a picture of the ring.
 * Rings from before the page opened stay quiet.
 */
export function DoorbellCall() {
  const { home } = useHome();
  const reduce = useReducedMotion();
  const devices = home?.devices;
  const seen = useRef<Map<string, string | null> | null>(null);
  const mic = useRef<MediaStreamTrack | null>(null);
  const [ring, setRing] = useState<EventDevice | null>(null);
  /** Opened from the tile rather than by a ring: no flash, and it says so. */
  const [looking, setLooking] = useState(false);
  const [listen, setListen] = useState(false);
  const [sender, setSender] = useState<RTCRtpSender | null>(null);
  const [talking, setTalking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!devices) return;
    const doorbells = devices.filter((device): device is EventDevice => device.kind === "event" && device.eventClass === "doorbell");
    if (!seen.current) {
      seen.current = new Map(doorbells.map(device => [device.id, device.last]));
      return;
    }
    for (const doorbell of doorbells) {
      const previous = seen.current.get(doorbell.id);
      seen.current.set(doorbell.id, doorbell.last);
      if (!doorbell.last || doorbell.last === previous || Date.now() - Date.parse(doorbell.last) >= FRESH_MS) continue;
      setRing(doorbell);
      setLooking(false);
      haptic("alert");
      window.dispatchEvent(new Event(WAKE_EVENT));
      void fetch("/api/doorbell", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: doorbell.id, at: doorbell.last }) }).catch(() => {});
    }
  }, [devices]);

  const stopTalking = () => {
    mic.current?.stop();
    mic.current = null;
    void sender?.replaceTrack(null).catch(() => {});
    setTalking(false);
  };
  const close = () => {
    stopTalking();
    setRing(null);
    setListen(false);
    setProblem(null);
  };
  const latestClose = useRef(close);
  useEffect(() => { latestClose.current = close; });

  useEffect(() => {
    if (!ring || listen || talking) return;
    const timer = setTimeout(() => latestClose.current(), UNANSWERED_MS);
    return () => clearTimeout(timer);
  }, [ring, listen, talking]);

  useEffect(() => {
    if (!ring) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") latestClose.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ring]);

  useEffect(() => () => mic.current?.stop(), []);

  useEffect(() => {
    const onLook = (event: Event) => {
      const doorbell = devices?.find((device): device is EventDevice => device.id === (event as CustomEvent<string>).detail && device.kind === "event");
      if (!doorbell) return;
      setLooking(true);
      setRing(doorbell);
    };
    window.addEventListener(LOOK_EVENT, onLook);
    return () => window.removeEventListener(LOOK_EVENT, onLook);
  }, [devices]);

  const toggleTalk = async () => {
    if (talking) return stopTalking();
    if (!sender) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const [track] = stream.getAudioTracks();
      await sender.replaceTrack(track);
      mic.current = track;
      setTalking(true);
      setListen(true);
      setProblem(null);
    } catch {
      setProblem("Hearth could not use the microphone. Allow it for this site, then try again.");
    }
  };

  const camera = ring && devices ? cameraFor(ring, devices) : null;
  return (
    <AnimatePresence>
      {ring && (
        <motion.div key={ring.id} role="alertdialog" aria-modal="true" aria-labelledby="doorbell-title" aria-describedby="doorbell-where" className={styles.call} data-camera={camera ? "" : undefined}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit } }}
          transition={{ duration: reduce ? 0 : motionTokens.duration.standard }}>
          {!reduce && !looking && <span key={ring.last} className={styles.flash} aria-hidden="true" />}
          <header className={styles.head}>
            <span className={styles.bell} data-still={looking || undefined} aria-hidden="true"><BellRing size={26} strokeWidth={1.75} /></span>
            <div className={styles.words}>
              <h2 id="doorbell-title" className={styles.title}>{looking ? "At the door" : "Someone is at the door"}</h2>
              <p id="doorbell-where" className={styles.where}>{ring.name}{ring.room ? ` · ${ring.room}` : ""}</p>
            </div>
          </header>
          <div className={styles.view}>
            {camera ? (
              <div className={styles.frame}><IntegrationCameraTile camera={camera} call={{ listen, onTalk: setSender }} /></div>
            ) : (
              <div className={styles.noCamera}>
                <VideoOff size={28} strokeWidth={1.75} aria-hidden="true" />
                <p>No camera is set up for this doorbell. Add the camera at the door from Home Assistant to see who it is.</p>
              </div>
            )}
          </div>
          {problem && <p className={styles.problem} role="status">{problem}</p>}
          <div className={styles.controls}>
            <CallButton icon={listen ? Volume2 : VolumeX} label={listen ? "Listening" : "Listen"} pressed={listen} disabled={!camera} onClick={() => setListen(value => !value)} />
            <CallButton icon={talking ? Mic : MicOff} label={talking ? "Talking" : "Talk"} pressed={talking} disabled={!sender}
              note={camera && !sender ? "Talking needs a direct connection to a camera with a speaker, such as on the home network" : undefined} onClick={() => void toggleTalk()} />
            <CallButton icon={X} label="Close" onClick={close} autoFocus />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CallButton({ icon: Icon, label, pressed, disabled, note, onClick, autoFocus }: { icon: LucideIcon; label: string; pressed?: boolean; disabled?: boolean; note?: string; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button type="button" className={styles.control} aria-pressed={pressed} disabled={disabled} onClick={onClick} title={note} aria-label={note ? `${label}. ${note}` : undefined} autoFocus={autoFocus}>
      <span className={styles.controlIcon}><Icon size={26} strokeWidth={1.75} aria-hidden="true" /></span>
      <span className={styles.controlLabel}>{label}</span>
    </button>
  );
}
