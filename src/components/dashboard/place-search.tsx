"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { SearchField } from "@/components/arc/search-field/search-field";
import { TextShimmer } from "@/components/arc/text-shimmer/text-shimmer";
import type { WeatherPlace } from "@/lib/dashboard/layout";
import styles from "./place-search.module.css";

interface Found extends WeatherPlace {
  region: string;
}

/** Type a city, pick the right one. Searches as you type, after a short pause. */
export function PlaceSearch({ onChoose }: { onChoose: (place: WeatherPlace) => void }) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        const response = await fetch(`/api/weather/places?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Search failed.");
        setPlaces(body.places);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const shown = query.trim().length < 2 ? [] : places;
  return (
    <div className={styles.search}>
      <SearchField label="City" value={query} onValueChange={setQuery} placeholder="Toronto, London, Tokyo" autoFocus />
      <div className={styles.results} aria-live="polite">
        {searching && <TextShimmer className={styles.hint}>Searching</TextShimmer>}
        {error && <p className={styles.error}>{error}</p>}
        {!searching && !error && query.trim().length >= 2 && shown.length === 0 && <p className={styles.hint}>No places found.</p>}
        {shown.map(place => (
          <button key={`${place.latitude},${place.longitude}`} type="button" className={styles.place} onClick={() => onChoose({ name: place.name, latitude: place.latitude, longitude: place.longitude })}>
            <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className={styles.name}>{place.name}</span>
            <span className={styles.region}>{place.region}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
