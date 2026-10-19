import "server-only";
import { IntegrationError } from "@/lib/integrations/types";
import type { TransitStop } from "@/lib/dashboard/layout";
import type { Departure, StopChoice } from "@/lib/transit-types";

/** Transitland, or a self-hosted Transitland server that speaks the same REST API. */
const BASE = process.env.TRANSITLAND_URL || "https://transit.land/api/v2/rest";
const TIMEOUT_MS = 10_000;
/** Departures change by the minute, so each stop is asked at most this often however many screens show it. */
const CACHE_MS = 20_000;
const cache = new Map<string, { at: number; departures: Departure[] }>();

async function call<T>(key: string, path: string, params: Record<string, string>) {
  let response: Response;
  try {
    response = await fetch(`${BASE}/${path}?${new URLSearchParams(params)}`, { headers: { apikey: key }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new IntegrationError("Could not reach Transitland.");
  }
  if (response.status === 401 || response.status === 403) throw new IntegrationError("Transitland rejected the API key.");
  if (response.status === 429) throw new IntegrationError("Transitland is rate limiting requests. Try again in a minute.");
  if (!response.ok) throw new IntegrationError(`Transitland returned ${response.status}.`);
  return response.json() as Promise<T>;
}

export async function checkTransitKey(key: string) {
  await call(key, "feeds", { limit: "1" });
}

interface RawStop {
  onestop_id?: string;
  stop_id?: string;
  stop_name?: string;
  stop_code?: string | null;
  geometry?: { coordinates?: [number, number] };
  feed_version?: { feed?: { onestop_id?: string } };
  route_stops?: { route?: { route_short_name?: string; route_long_name?: string } }[];
}

const metres = (lat: number, lon: number, [toLon, toLat]: [number, number]) => {
  const rad = Math.PI / 180;
  const x = (toLon - lon) * rad * Math.cos(((lat + toLat) / 2) * rad);
  return Math.round(Math.hypot(x, (toLat - lat) * rad) * 6_371_000);
};

/** Stops by name, near home when its location is known, nearest first; platforms of one station share a name. */
export async function findStops(key: string, query: string, near: { latitude: number; longitude: number } | null): Promise<StopChoice[]> {
  const params: Record<string, string> = { limit: "40", include_routes: "true" };
  if (query) params.search = query;
  if (near) Object.assign(params, { lat: String(near.latitude), lon: String(near.longitude), radius: query ? "10000" : "1200" });
  if (!query && !near) return [];
  const { stops = [] } = await call<{ stops?: RawStop[] }>(key, "stops", params);
  const choices = stops.flatMap((stop): StopChoice[] => {
    const feed = stop.feed_version?.feed?.onestop_id;
    const key = stop.onestop_id ?? (feed && stop.stop_id ? `${feed}:${stop.stop_id}` : null);
    if (!key || !stop.stop_name) return [];
    const routes = [...new Set((stop.route_stops ?? []).map(item => item.route?.route_short_name || item.route?.route_long_name || "").filter(Boolean))].slice(0, 8);
    return [{ key, name: stop.stop_name, code: stop.stop_code ?? null, distance: near && stop.geometry?.coordinates ? metres(near.latitude, near.longitude, stop.geometry.coordinates) : null, routes }];
  });
  return choices.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

interface RawDeparture {
  departure?: { scheduled_utc?: string; estimated_utc?: string | null; delay?: number | null; estimated_delay?: number | null };
  schedule_relationship?: string;
  stop_headsign?: string;
  trip?: { trip_id?: string; trip_headsign?: string; route?: { route_short_name?: string; route_long_name?: string; route_color?: string } };
}

/** The next hour and a half of departures from these stops, soonest first. */
export async function departuresFrom(key: string, stops: TransitStop[]): Promise<Departure[]> {
  const lists = await Promise.all(stops.map(async stop => {
    const cached = cache.get(stop.key);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.departures;
    const { stops: found = [] } = await call<{ stops?: { departures?: RawDeparture[] }[] }>(key, `stops/${encodeURIComponent(stop.key)}/departures`, { next: "5400", limit: "30" });
    const departures = found.flatMap(item => item.departures ?? []).flatMap((raw, index): Departure[] => {
      const scheduled = raw.departure?.scheduled_utc;
      const estimated = raw.departure?.estimated_utc ?? null;
      if (!scheduled && !estimated) return [];
      const color = raw.trip?.route?.route_color;
      return [{
        id: `${stop.key}:${raw.trip?.trip_id ?? index}:${scheduled}`,
        stop: stop.name,
        route: raw.trip?.route?.route_short_name || raw.trip?.route?.route_long_name || "",
        color: color && /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : null,
        headsign: raw.trip?.trip_headsign || raw.stop_headsign || "",
        at: (estimated ?? scheduled) as string,
        live: Boolean(estimated),
        delay: raw.departure?.delay ?? raw.departure?.estimated_delay ?? null,
        canceled: raw.schedule_relationship === "CANCELED",
      }];
    });
    cache.set(stop.key, { at: Date.now(), departures });
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return departures;
  }));
  const now = Date.now() - 30_000;
  return lists.flat().filter(item => Date.parse(item.at) >= now).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
