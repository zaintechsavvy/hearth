"use client";

import { Download, Info, Maximize2, RotateCw, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import type { CameraDevice } from "@/lib/devices/types";
import type { IceCandidate, IceServer } from "@/lib/integrations/types";
import { candidateHosts, firstFrame, timeout } from "./camera-frames";
import styles from "./camera-tile.module.css";

type Stage = "webrtc" | "hls" | "mjpeg";
type View =
  | { kind: "connecting"; stage: Stage }
  | { kind: "live"; stage: Stage }
  | { kind: "picture" }
  | { kind: "offline" };

const WEBRTC_FRAME_MS = 10_000;
const HLS_FRAME_MS = 20_000;
const MJPEG_FRAME_MS = 8000;
const PICTURE_MS = 2000;
const KEEPALIVE_MS = 20_000;
/** While only a still is showing, try for live video again this often. */
const RETRY_LIVE_MS = 120_000;
const RECONNECTS = 3;
const PICTURE_FAILURES = 3;
const STAGE_NAMES: Record<Stage, string> = { webrtc: "WebRTC", hls: "HLS", mjpeg: "MJPEG" };

/** A reason as the end of a sentence: "WebRTC: this browser could not reach the video." */
function message(error: unknown) {
  const text = (error instanceof Error ? error.message : "it stopped").replace(/\.+$/, "");
  return text[0].toLowerCase() + text.slice(1);
}

function iceGathered(peer: RTCPeerConnection, ms = 2500) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>(resolve => {
    const done = () => { peer.removeEventListener("icegatheringstatechange", check); resolve(); };
    const check = () => { if (peer.iceGatheringState === "complete") done(); };
    peer.addEventListener("icegatheringstatechange", check);
    setTimeout(done, ms);
  });
}

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? fallback;
}

/** A receive-only call through Hearth to the integration, using the ICE servers it recommends. Resolves at the first painted frame. */
async function playWebRtc(base: string, video: HTMLVideoElement, signal: AbortSignal, cleanups: (() => void)[], onDrop: () => void) {
  const config = await fetch(`${base}/webrtc`, { signal });
  if (!config.ok) throw new Error(await readError(config, "Home Assistant did not answer"));
  const { supported, iceServers } = await config.json() as { supported: boolean; iceServers: IceServer[] };
  if (!supported) throw new Error("this camera does not offer it in Home Assistant");
  const peer = new RTCPeerConnection({ iceServers });
  cleanups.push(() => peer.close());
  peer.addTransceiver("video", { direction: "recvonly" });
  peer.addTransceiver("audio", { direction: "recvonly" });
  peer.addEventListener("track", event => {
    if (event.track.kind === "video") video.srcObject = new MediaStream([event.track]);
  });
  await peer.setLocalDescription(await peer.createOffer());
  await iceGathered(peer);
  const response = await fetch(`${base}/webrtc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer: peer.localDescription?.sdp }), signal });
  if (!response.ok) throw new Error(await readError(response, "the camera refused the call"));
  const { session, answer, candidates } = await response.json() as { session: string; answer: string; candidates: IceCandidate[] };
  const hangUp = () => void fetch(`${base}/webrtc?session=${session}`, { method: "DELETE", keepalive: true });
  const keepalive = setInterval(() => void fetch(`${base}/webrtc?session=${session}`, { method: "PATCH" }), KEEPALIVE_MS);
  window.addEventListener("pagehide", hangUp, { signal });
  cleanups.push(() => { clearInterval(keepalive); hangUp(); });
  await peer.setRemoteDescription({ type: "answer", sdp: answer });
  for (const candidate of candidates) await peer.addIceCandidate(candidate).catch(() => {});

  const hosts = candidateHosts(answer, candidates);
  const unreachable = new Promise<never>((_, reject) => peer.addEventListener("iceconnectionstatechange", () => {
    if (peer.iceConnectionState === "failed") reject(new Error(`this browser could not reach the video at ${hosts.join(", ") || "Home Assistant"}`));
  }));
  await Promise.race([firstFrame(video, signal), unreachable, timeout(WEBRTC_FRAME_MS, signal, "connected, but no picture arrived in 10 seconds")]);
  peer.addEventListener("connectionstatechange", () => { if (peer.connectionState === "failed") onDrop(); });
}

/** HLS relayed through Hearth: needs only the HTTP path Hearth already uses, so it works where WebRTC cannot connect. */
async function playHls(base: string, video: HTMLVideoElement, signal: AbortSignal, cleanups: (() => void)[], onDrop: () => void) {
  const response = await fetch(`${base}/hls`, { method: "POST", signal });
  if (!response.ok) throw new Error(await readError(response, "not offered for this camera"));
  const { playlist } = await response.json() as { playlist: string };
  video.srcObject = null;
  const { default: Hls } = await import("hls.js");
  let fatal: Promise<never>;
  if (Hls.isSupported()) {
    const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 2, backBufferLength: 10 });
    cleanups.push(() => hls.destroy());
    let playing = false;
    fatal = new Promise<never>((_, reject) => hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (playing) onDrop();
      else reject(new Error(`the stream failed (${data.details})`));
    }));
    hls.loadSource(playlist);
    hls.attachMedia(video);
    firstFrame(video, signal).then(() => { playing = true; }, () => {});
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = playlist;
    cleanups.push(() => { video.removeAttribute("src"); video.load(); });
    fatal = new Promise<never>((_, reject) => video.addEventListener("error", () => reject(new Error("the stream failed")), { once: true, signal }));
  } else {
    throw new Error("this browser cannot play it");
  }
  void video.play().catch(() => {});
  await Promise.race([firstFrame(video, signal), fatal, timeout(HLS_FRAME_MS, signal, "no picture arrived in 20 seconds")]);
}

/**
 * A camera an integration relays, such as any Home Assistant camera. Tries WebRTC the way Home Assistant's own app
 * does, then HLS relayed through Hearth, then MJPEG, and only then shows the last picture, saying why.
 * "Live" appears once a frame has actually been painted.
 */
export function IntegrationCameraTile({ camera }: { camera: CameraDevice }) {
  const frame = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [view, setView] = useState<View>(camera.streamable ? { kind: "connecting", stage: "webrtc" } : { kind: "offline" });
  const [notes, setNotes] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [tick, setTick] = useState(0);
  const [poster, setPoster] = useState(true);
  const reconnects = useRef(0);
  const pictureFailures = useRef(0);
  const base = `/api/devices/${encodeURIComponent(camera.id)}/camera`;
  const stage = view.kind === "connecting" || view.kind === "live" ? view.stage : null;

  useEffect(() => {
    const element = video.current;
    if (!camera.streamable || !element) return;
    const controller = new AbortController();
    const cleanups: (() => void)[] = [];
    const reset = () => {
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      element.srcObject = null;
    };
    const onDrop = () => {
      if (controller.signal.aborted) return;
      reconnects.current += 1;
      if (reconnects.current > RECONNECTS) setView({ kind: "picture" });
      else setAttempt(value => value + 1);
    };
    const run = async () => {
      const failures: string[] = [];
      for (const [next, play] of [["webrtc", playWebRtc], ["hls", playHls]] as const) {
        if (next === "hls") setView({ kind: "connecting", stage: "hls" });
        try {
          await play(base, element, controller.signal, cleanups, onDrop);
          if (controller.signal.aborted) return;
          setNotes(failures);
          setView({ kind: "live", stage: next });
          return;
        } catch (error) {
          if (controller.signal.aborted) return;
          failures.push(`${STAGE_NAMES[next]}: ${message(error)}.`);
          console.warn(`${camera.name}: ${STAGE_NAMES[next]} did not play, ${message(error)}.`);
          reset();
        }
      }
      setNotes(failures);
      setView({ kind: "connecting", stage: "mjpeg" });
    };
    void run();
    return () => {
      controller.abort();
      reset();
    };
  }, [base, camera.name, camera.streamable, attempt]);

  useEffect(() => {
    if (view.kind !== "connecting" || view.stage !== "mjpeg") return;
    const timer = setTimeout(() => {
      setNotes(current => [...current, "MJPEG: no picture arrived in 8 seconds."]);
      setView({ kind: "picture" });
    }, MJPEG_FRAME_MS);
    return () => clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    if (view.kind !== "picture") return;
    const pictures = setInterval(() => setTick(value => value + 1), PICTURE_MS);
    const live = setTimeout(() => {
      reconnects.current = 0;
      setView({ kind: "connecting", stage: "webrtc" });
      setAttempt(value => value + 1);
    }, RETRY_LIVE_MS);
    return () => {
      clearInterval(pictures);
      clearTimeout(live);
    };
  }, [view.kind]);

  const retry = () => {
    reconnects.current = 0;
    pictureFailures.current = 0;
    setPoster(true);
    setNotes([]);
    setView({ kind: "connecting", stage: "webrtc" });
    setAttempt(value => value + 1);
  };

  const live = view.kind === "live";
  const state = live ? "live" : view.kind === "picture" ? "snapshot" : view.kind === "offline" ? "offline" : "connecting";
  const videoShown = live && stage !== "mjpeg";
  return (
    <figure ref={frame} className={`${glassClass()} ${styles.tile} ${styles.fill}`} data-state={state}>
      {poster && view.kind === "connecting" && (
        // eslint-disable-next-line @next/next/no-img-element -- an authenticated, live JPEG that must bypass the image optimiser
        <img className={`${styles.media} ${styles.poster}`} src={`${base}?mode=snapshot&poster=${attempt}`} alt="" aria-hidden="true" onError={() => setPoster(false)} />
      )}
      <video ref={video} className={styles.media} autoPlay muted playsInline hidden={!videoShown} aria-label={`Live view from ${camera.name}`} />
      {stage === "mjpeg" && (
        // eslint-disable-next-line @next/next/no-img-element -- a live MJPEG stream that must bypass the image optimiser
        <img className={styles.media} src={`${base}?attempt=${attempt}`} alt={`Live view from ${camera.name}`} hidden={!live}
          onLoad={() => setView({ kind: "live", stage: "mjpeg" })}
          onError={() => { setNotes(current => [...current, "MJPEG: Home Assistant refused the stream."]); setView({ kind: "picture" }); }} />
      )}
      {view.kind === "picture" && (
        // eslint-disable-next-line @next/next/no-img-element -- a live, authenticated JPEG that must bypass the image optimiser
        <img className={styles.media} src={`${base}?mode=snapshot&frame=${tick}`} alt={`Last picture from ${camera.name}`}
          onLoad={() => { pictureFailures.current = 0; }}
          onError={() => { pictureFailures.current += 1; if (pictureFailures.current >= PICTURE_FAILURES) setView({ kind: "offline" }); }} />
      )}
      {view.kind === "offline" && (
        <div className={styles.offline}>
          <VideoOff size={24} strokeWidth={1.75} aria-hidden="true" />
          <p>{camera.streamable ? "Cannot reach this camera" : "This camera is visible over Matter, but its video is not. Add it through Home Assistant or as an RTSP camera to watch it here."}</p>
          {camera.streamable && (
            <button type="button" className={`${glassClass("pill")} ${styles.retry}`} onClick={retry}>
              <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" /> Try again
            </button>
          )}
        </div>
      )}
      <figcaption className={`${glassClass("pill")} ${styles.caption}`}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.name}>{camera.name}</span>
        <span className={styles.badge} title={live ? `Playing over ${STAGE_NAMES[view.stage]}` : undefined}>
          {view.kind === "connecting" ? <TextShimmer>{view.stage === "webrtc" ? "Connecting" : `Trying ${STAGE_NAMES[view.stage]}`}</TextShimmer>
            : live ? "Live" : view.kind === "picture" ? "Last picture" : "No video"}
        </span>
      </figcaption>
      {view.kind === "picture" && (
        <div className={`${glassClass("pill")} ${styles.notice}`}>
          <span>Live video unavailable</span>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={styles.noticeButton} aria-label="Why live video is unavailable"><Info size={15} strokeWidth={1.75} aria-hidden="true" /></button>
            </PopoverTrigger>
            <PopoverContent className={`${glassSheetClass} ${styles.reasons}`}>
              <p className={styles.reasonsTitle}>What Hearth tried</p>
              <ul>{notes.map(note => <li key={note}>{note}</li>)}</ul>
              <p className={styles.reasonsHint}>The picture is the last one Home Assistant has, which can be old. Hearth tries live video again every two minutes.</p>
            </PopoverContent>
          </Popover>
          <button type="button" className={styles.noticeButton} onClick={retry} aria-label="Try live video again"><RotateCw size={15} strokeWidth={1.75} aria-hidden="true" /></button>
        </div>
      )}
      {view.kind !== "offline" && (
        <div className={styles.tools}>
          <a className={`${glassClass("pill")} ${styles.tool}`} href={`${base}?mode=snapshot&save=1`} download={`${camera.name}.jpg`} aria-label={`Save a snapshot from ${camera.name}`} title="Save a snapshot">
            <Download size={16} strokeWidth={1.75} aria-hidden="true" />
          </a>
          <button type="button" className={`${glassClass("pill")} ${styles.tool}`} onClick={() => frame.current?.requestFullscreen?.()} aria-label={`Show ${camera.name} full screen`} title="Full screen">
            <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}
    </figure>
  );
}
