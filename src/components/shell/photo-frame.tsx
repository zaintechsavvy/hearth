"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import type { PhotoSource } from "@/lib/wall";
import styles from "./photo-frame.module.css";

interface Photo {
  id: string;
  width: number;
  height: number;
  src: string;
}

const fetchPhotos = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error();
  return (await response.json() as { photos: Photo[] }).photos;
};

/** A photo shaped unlike the screen sits whole over a blurred copy of itself, instead of being cropped. */
const fits = (photo: Photo) => Math.abs(Math.log((photo.width / photo.height) / (window.innerWidth / window.innerHeight))) > 0.35;

/**
 * The wall tablet's photo frame: each photo drifts slowly, Ken Burns style, then crossfades to the next. The next one
 * loads ahead so the change never shows a blank, and the list is fetched again now and then so new photos join in.
 */
export function PhotoFrame({ source, seconds, onEmpty }: { source: PhotoSource; seconds: number; onEmpty: (empty: boolean) => void }) {
  const reduce = useReducedMotion();
  const { data, error } = useSWR(`/api/photos?source=${source}`, fetchPhotos, { refreshInterval: 15 * 60_000, revalidateOnFocus: false });
  const photos = useMemo(() => data ?? [], [data]);
  const [index, setIndex] = useState(0);
  const empty = Boolean(error) || (data !== undefined && photos.length === 0);

  useEffect(() => { onEmpty(empty); }, [empty, onEmpty]);

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = setInterval(() => setIndex(value => value + 1), seconds * 1000);
    return () => clearInterval(timer);
  }, [photos.length, seconds]);

  useEffect(() => {
    const next = photos[(index + 1) % Math.max(photos.length, 1)];
    if (next) new Image().src = next.src;
  }, [index, photos]);

  const photo = photos.length ? photos[index % photos.length] : null;
  if (!photo) return null;
  const whole = fits(photo);
  return (
    <span className={styles.frame} aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.span key={`${photo.id}-${index}`} className={styles.slide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 1.8, ease: "easeInOut" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- photos relayed with the session cookie, which the image optimiser cannot fetch */}
          {whole && <img className={styles.fill} src={photo.src} alt="" />}
          {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
          <img className={styles.photo} src={photo.src} alt="" data-whole={whole || undefined} data-drift={reduce ? undefined : index % 2 ? "b" : "a"}
            style={{ animationDuration: `${seconds + 2}s` }} />
        </motion.span>
      </AnimatePresence>
      <span className={styles.shade} />
    </span>
  );
}
