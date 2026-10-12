import "server-only";
import { IntegrationError } from "@/lib/integrations/types";

export interface Place {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

export interface Forecast {
  timezone: string;
  current: { temperature: number; feelsLike: number; humidity: number; wind: number; code: number; day: boolean; time: string };
  hourly: { time: string; temperature: number; code: number }[];
  daily: { date: string; high: number; low: number; code: number; rain: number | null }[];
}

const CACHE_MS = 10 * 60_000;
const registry = globalThis as unknown as { hearthWeather?: Map<string, { at: number; forecast: Forecast }> };
const cache = registry.hearthWeather ??= new Map();

async function get<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  } catch {
    throw new IntegrationError("Could not reach the weather service.");
  }
  if (!response.ok) throw new IntegrationError(`The weather service answered with ${response.status}.`);
  return response.json() as Promise<T>;
}

/** City search from Open-Meteo's free geocoder; no account or key needed. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const params = new URLSearchParams({ name: query, count: "6", language: "en", format: "json" });
  const data = await get<{ results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] }>(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  return (data.results ?? []).map(result => ({
    name: result.name,
    region: [result.admin1, result.country].filter(Boolean).join(", "),
    latitude: result.latitude,
    longitude: result.longitude,
  }));
}

/** The forecast in Celsius; tiles convert for people who prefer Fahrenheit. Cached for ten minutes per place. */
export async function forecastFor(latitude: number, longitude: number): Promise<Forecast> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.forecast;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m",
    hourly: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7",
  });
  const data = await get<{
    timezone: string;
    current: { time: string; temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; is_day: number; wind_speed_10m: number };
    hourly: { time: string[]; temperature_2m: number[]; weather_code: number[] };
    daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] };
  }>(`https://api.open-meteo.com/v1/forecast?${params}`);
  const now = data.current.time;
  const start = Math.max(0, data.hourly.time.findIndex(time => time >= now.slice(0, 13)));
  const forecast: Forecast = {
    timezone: data.timezone,
    current: {
      temperature: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      wind: data.current.wind_speed_10m,
      code: data.current.weather_code,
      day: data.current.is_day === 1,
      time: now,
    },
    hourly: data.hourly.time.slice(start, start + 12).map((time, index) => ({ time, temperature: data.hourly.temperature_2m[start + index], code: data.hourly.weather_code[start + index] })),
    daily: data.daily.time.map((date, index) => ({
      date,
      high: data.daily.temperature_2m_max[index],
      low: data.daily.temperature_2m_min[index],
      code: data.daily.weather_code[index],
      rain: data.daily.precipitation_probability_max[index] ?? null,
    })),
  };
  cache.set(key, { at: Date.now(), forecast });
  return forecast;
}
