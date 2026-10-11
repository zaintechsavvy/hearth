"use client";

import { Maximize2, RotateCw, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import { glassClass } from "@/components/glass/glass";
import styles from "./camera-tile.module.css";

type StreamState = "connecting" | "live" | "snapshot" | "offline";

const CONNECT_TIMEOUT_MS = 10_000;
const SNAPSHOT_MS = 3000;

function iceGathered(peer: RTCPeerConnection, timeoutMs = 2500) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>(resolve => {
    const done = () => { peer.removeEventListener("icegatheringstatechange", check); resolve(); };
    const check = () => { if (peer.iceGatheringState === "complete") done(); };
    peer.addEventListener("icegatheringstatechange", check);
    setTimeout(done, timeoutMs);
  });
}

/** go2rtc answers a complete offer over HTTP, so ICE gathering finishes before the offer is sent. */
async function connect(cameraId: string, video: HTMLVideoElement, signal: AbortSignal) {
  const peer = new RTCPeerConnection();
  signal.addEventListener("abort", () => peer.close());
  peer.addTransceiver("video", { direction: "recvonly" });
  peer.addTransceiver("audio", { direction: "recvonly" });
  peer.addEventListener("track", event => {
    video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
  });
  await peer.setLocalDescription(await peer.createOffer());
  await iceGathered(peer);
  const response = await fetch(`/api/cameras/${cameraId}/webrtc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sdp: peer.localDescription?.sdp }),
    signal,
  });
  if (!response.ok) throw new Error("Relay refused the stream");
  const { sdp } = await response.json() as { sdp: string };
  await peer.setRemoteDescription({ type: "answer", sdp });
  return peer;
}

export function CameraTile({ camera }: { camera: { id: string; name: string } }) {
  const frame = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<StreamState>("connecting");
  const [attempt, setAttempt] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const controller = new AbortController();
    const fallback = setTimeout(() => setState(current => current === "connecting" ? "snapshot" : current), CONNECT_TIMEOUT_MS);
    connect(camera.id, element, controller.signal)
      .then(peer => peer.addEventListener("connectionstatechange", () => {
        if (peer.connectionState === "failed" || peer.connectionState === "disconnected") setState("snapshot");
      }))
      .catch(() => { if (!controller.signal.aborted) setState("snapshot"); });
    return () => {
      clearTimeout(fallback);
      controller.abort();
    };
  }, [camera.id, attempt]);

  useEffect(() => {
    if (state !== "snapshot") return;
    const interval = setInterval(() => setTick(value => value + 1), SNAPSHOT_MS);
    return () => clearInterval(interval);
  }, [state]);

  const retry = () => {
    setState("connecting");
    setAttempt(value => value + 1);
  };

  return (
    <figure ref={frame} className={`${glassClass()} ${styles.tile}`} data-state={state}>
      <video ref={video} className={styles.media} autoPlay muted playsInline onPlaying={() => setState("live")} hidden={state === "snapshot" || state === "offline"} />
      {state === "snapshot" && (
        // eslint-disable-next-line @next/next/no-img-element -- a live, authenticated JPEG that must bypass the image optimiser
        <img className={styles.media} src={`/api/cameras/${camera.id}/snapshot?frame=${tick}`} alt={`Latest frame from ${camera.name}`} onError={() => setState("offline")} />
      )}
      {state === "offline" && (
        <div className={styles.offline}>
          <VideoOff size={24} strokeWidth={1.75} aria-hidden="true" />
          <p>Cannot reach this camera</p>
          <button type="button" className={`${glassClass("pill")} ${styles.retry}`} onClick={retry}>
            <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" /> Try again
          </button>
        </div>
      )}
      <figcaption className={`${glassClass("pill")} ${styles.caption}`}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.name}>{camera.name}</span>
        <span className={styles.badge}>
          {state === "connecting" ? <TextShimmer>Connecting</TextShimmer> : state === "live" ? "Live" : state === "snapshot" ? "Snapshot" : "Offline"}
        </span>
      </figcaption>
      <button type="button" className={`${glassClass("pill")} ${styles.fullscreen}`} onClick={() => frame.current?.requestFullscreen?.()} aria-label={`Show ${camera.name} full screen`}>
        <Maximize2 size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </figure>
  );
}
