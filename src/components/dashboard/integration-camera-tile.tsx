"use client";

import { Download, Maximize2, RotateCw, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { glassClass } from "@/components/glass/glass";
import type { CameraDevice } from "@/lib/devices/types";
import type { IceCandidate } from "@/lib/integrations/types";
import styles from "./camera-tile.module.css";

type Mode = "webrtc" | "mjpeg" | "snapshot" | "offline";

const WEBRTC_TIMEOUT_MS = 12_000;
const MJPEG_TIMEOUT_MS = 8000;
const SNAPSHOT_MS = 2000;
const KEEPALIVE_MS = 20_000;
const SNAPSHOT_FAILURES = 3;

function iceGathered(peer: RTCPeerConnection, timeoutMs = 2500) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>(resolve => {
    const done = () => { peer.removeEventListener("icegatheringstatechange", check); resolve(); };
    const check = () => { if (peer.iceGatheringState === "complete") done(); };
    peer.addEventListener("icegatheringstatechange", check);
    setTimeout(done, timeoutMs);
  });
}

/** Offers a receive-only call through Hearth, which hands it to the integration; resolves with the session to keep alive. */
async function connect(base: string, video: HTMLVideoElement, signal: AbortSignal) {
  const peer = new RTCPeerConnection();
  signal.addEventListener("abort", () => peer.close());
  peer.addTransceiver("video", { direction: "recvonly" });
  peer.addTransceiver("audio", { direction: "recvonly" });
  peer.addEventListener("track", event => {
    video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
  });
  await peer.setLocalDescription(await peer.createOffer());
  await iceGathered(peer);
  const response = await fetch(`${base}/webrtc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offer: peer.localDescription?.sdp }),
    signal,
  });
  if (!response.ok) throw new Error(response.status === 409 ? "unsupported" : "refused");
  const { session, answer, candidates } = await response.json() as { session: string; answer: string; candidates: IceCandidate[] };
  await peer.setRemoteDescription({ type: "answer", sdp: answer });
  for (const candidate of candidates) await peer.addIceCandidate(candidate).catch(() => {});
  return { peer, session };
}

/**
 * A camera an integration relays, such as any Home Assistant camera. Plays WebRTC the way Home Assistant's own
 * frontend does, falls back to MJPEG and then to refreshing snapshots, and shows a still while it connects.
 * The badge says Live only once frames are actually playing.
 */
export function IntegrationCameraTile({ camera }: { camera: CameraDevice }) {
  const frame = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>(camera.streamable ? "webrtc" : "offline");
  const [playing, setPlaying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tick, setTick] = useState(0);
  const [poster, setPoster] = useState(true);
  const failures = useRef(0);
  const base = `/api/devices/${encodeURIComponent(camera.id)}/camera`;

  useEffect(() => {
    const element = video.current;
    if (mode !== "webrtc" || !element) return;
    const controller = new AbortController();
    let session: string | null = null;
    let keepalive: ReturnType<typeof setInterval> | undefined;
    const fallBack = () => {
      if (controller.signal.aborted) return;
      setPlaying(false);
      setMode("mjpeg");
    };
    const timeout = setTimeout(fallBack, WEBRTC_TIMEOUT_MS);
    element.addEventListener("playing", () => clearTimeout(timeout), { once: true, signal: controller.signal });
    const hangUp = () => {
      if (session) void fetch(`${base}/webrtc?session=${session}`, { method: "DELETE", keepalive: true });
      session = null;
    };
    window.addEventListener("pagehide", hangUp, { signal: controller.signal });
    connect(base, element, controller.signal)
      .then(result => {
        session = result.session;
        keepalive = setInterval(() => void fetch(`${base}/webrtc?session=${session}`, { method: "PATCH" }), KEEPALIVE_MS);
        result.peer.addEventListener("connectionstatechange", () => {
          if (result.peer.connectionState === "failed") fallBack();
        });
      })
      .catch(fallBack);
    return () => {
      clearTimeout(timeout);
      clearInterval(keepalive);
      controller.abort();
      hangUp();
      element.srcObject = null;
    };
  }, [base, mode, attempt]);

  useEffect(() => {
    if (mode !== "mjpeg" || playing) return;
    const timeout = setTimeout(() => setMode("snapshot"), MJPEG_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [mode, playing]);

  useEffect(() => {
    if (mode !== "snapshot") return;
    const timer = setInterval(() => setTick(value => value + 1), SNAPSHOT_MS);
    return () => clearInterval(timer);
  }, [mode]);

  const go = (next: Mode) => {
    setPlaying(false);
    setMode(next);
  };
  const retry = () => {
    failures.current = 0;
    setPoster(true);
    go("webrtc");
    setAttempt(value => value + 1);
  };
  const snapshotFailed = () => {
    failures.current += 1;
    if (failures.current >= SNAPSHOT_FAILURES) go("offline");
  };

  const state = mode === "offline" ? "offline" : playing && mode !== "snapshot" ? "live" : mode === "snapshot" ? "snapshot" : "connecting";
  const showPoster = poster && mode !== "offline" && !playing;
  return (
    <figure ref={frame} className={`${glassClass()} ${styles.tile} ${styles.fill}`} data-state={state}>
      {showPoster && (
        // eslint-disable-next-line @next/next/no-img-element -- an authenticated, live JPEG that must bypass the image optimiser
        <img className={styles.media} src={`${base}?mode=snapshot&poster=${attempt}`} alt="" aria-hidden="true" onError={() => setPoster(false)} />
      )}
      <video ref={video} className={styles.media} autoPlay muted playsInline hidden={mode !== "webrtc"} onPlaying={() => setPlaying(true)} />
      {mode === "mjpeg" && (
        // eslint-disable-next-line @next/next/no-img-element -- a live MJPEG stream that must bypass the image optimiser
        <img className={styles.media} src={`${base}?attempt=${attempt}`} alt={`Live view from ${camera.name}`} onLoad={() => setPlaying(true)} onError={() => go("snapshot")} hidden={!playing} />
      )}
      {mode === "snapshot" && (
        // eslint-disable-next-line @next/next/no-img-element -- a live, authenticated JPEG that must bypass the image optimiser
        <img className={styles.media} src={`${base}?mode=snapshot&frame=${tick}`} alt={`Latest frame from ${camera.name}`} onLoad={() => { failures.current = 0; }} onError={snapshotFailed} />
      )}
      {mode === "offline" && (
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
        <span className={styles.badge}>
          {state === "connecting" ? <TextShimmer>Connecting</TextShimmer> : state === "live" ? "Live" : state === "snapshot" ? "Snapshot" : "No video"}
        </span>
      </figcaption>
      {mode !== "offline" && (
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
