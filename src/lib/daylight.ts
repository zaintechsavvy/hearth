const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

/**
 * Where the sun is between today's sunrise and sunset, by time of day: `progress` runs 0 to 1 across the day while it is
 * up, and 0 to 1 across the night from sunset to the next sunrise while it is down. `left` is the minutes until it next
 * sets or rises.
 */
export function sunProgress(now: Date, sunrise: Date, sunset: Date) {
  const at = minuteOfDay(now), rise = minuteOfDay(sunrise), set = minuteOfDay(sunset);
  const night = 1440 - (set - rise);
  if (at >= rise && at < set) return { up: true, progress: (at - rise) / (set - rise), left: set - at };
  const since = (at - set + 1440) % 1440;
  return { up: false, progress: since / night, left: night - since };
}
