"use client";

import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, MapPin, Moon, Sun, type LucideIcon } from "lucide-react";
import useSWR from "swr";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { glassClass } from "@/components/glass/glass";
import type { TileConfig } from "@/lib/dashboard/layout";
import { sky, skyWords, type Sky } from "@/lib/widgets/weather-codes";
import type { Forecast } from "@/lib/widgets/weather";
import styles from "./weather-tile.module.css";

const REFRESH_MS = 10 * 60_000;
const ICONS: Record<Sky, [LucideIcon, LucideIcon]> = {
  clear: [Sun, Moon], partly: [CloudSun, CloudMoon], cloudy: [Cloud, Cloud], fog: [CloudFog, CloudFog],
  drizzle: [CloudDrizzle, CloudDrizzle], rain: [CloudRain, CloudRain], snow: [CloudSnow, CloudSnow], storm: [CloudLightning, CloudLightning],
};

const fetchForecast = async (url: string): Promise<Forecast> => {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Weather is unavailable.");
  return body;
};

interface WeatherTileProps {
  tile: TileConfig;
  onChoosePlace: () => void;
  interactive?: boolean;
}

/** Weather for a place, from Open-Meteo: now, the next hours, or the week, depending on the tile size. */
export function WeatherTile({ tile, onChoosePlace, interactive = true }: WeatherTileProps) {
  const place = tile.options?.place;
  const units = tile.options?.units ?? "C";
  const { data, error } = useSWR<Forecast>(place ? `/api/weather?lat=${place.latitude}&lon=${place.longitude}` : null, fetchForecast, { refreshInterval: REFRESH_MS });
  const degrees = (celsius: number) => `${Math.round(units === "F" ? celsius * 9 / 5 + 32 : celsius)}°`;

  if (!place) {
    return (
      <button type="button" className={`${glassClass("panel")} ${styles.tile} ${styles.setup}`} onClick={onChoosePlace} disabled={!interactive}>
        <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />
        <span>Choose a city</span>
      </button>
    );
  }
  if (error) return <div className={`${glassClass("panel")} ${styles.tile} ${styles.setup}`}><span className={styles.muted}>{error.message}</span></div>;
  if (!data) return <div className={`${glassClass("panel")} ${styles.tile}`} aria-busy="true"><Skeleton lines={2} label="Loading the weather" /></div>;

  const Icon = ICONS[sky(data.current.code)][data.current.day ? 0 : 1];
  const today = data.daily[0];
  const hours = data.hourly.slice(1, 6);
  return (
    <section className={`${glassClass("panel")} ${styles.tile}`} data-size={tile.size} data-sky={sky(data.current.code)} data-day={data.current.day || undefined} aria-label={`Weather in ${place.name}`}>
      <div className={styles.now}>
        <Icon className={styles.icon} size={tile.size === "2x1" ? 30 : 36} strokeWidth={1.5} aria-hidden="true" />
        <div className={styles.reading}>
          <span className={styles.temperature}>{degrees(data.current.temperature)}</span>
          <span className={styles.words}>{skyWords(data.current.code, data.current.day)}</span>
        </div>
        <div className={styles.where}>
          <span className={styles.place}>{place.name}</span>
          <span className={styles.muted}>H {degrees(today.high)} · L {degrees(today.low)}</span>
        </div>
      </div>
      {tile.size === "2x2" && (
        <ol className={styles.hours} aria-label="Next hours">
          {hours.map(hour => {
            const HourIcon = ICONS[sky(hour.code)][0];
            return (
              <li key={hour.time} className={styles.hour}>
                <span className={styles.muted}>{new Date(hour.time).toLocaleTimeString(undefined, { hour: "numeric" })}</span>
                <HourIcon size={18} strokeWidth={1.75} aria-hidden="true" />
                <span>{degrees(hour.temperature)}</span>
              </li>
            );
          })}
        </ol>
      )}
      {tile.size === "4x2" && (
        <ol className={styles.days} aria-label="This week">
          {data.daily.map((day, index) => {
            const DayIcon = ICONS[sky(day.code)][0];
            return (
              <li key={day.date} className={styles.day}>
                <span className={styles.muted}>{index === 0 ? "Today" : new Date(`${day.date}T12:00`).toLocaleDateString(undefined, { weekday: "short" })}</span>
                <DayIcon size={20} strokeWidth={1.75} aria-hidden="true" />
                <span>{degrees(day.high)}</span>
                <span className={styles.muted}>{degrees(day.low)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
