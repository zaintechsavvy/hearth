/** The durations a fan timer snaps to: every ten minutes up to an hour, then the longer runs a thermostat allows. */
export const FAN_TIMER_MINUTES = [10, 20, 30, 40, 50, 60, 120, 240, 480, 720];

export function fanDuration(minutes: number) {
  const hours = Math.floor(minutes / 60), rest = Math.round(minutes % 60);
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Minutes left on a timer ending at `until`, to the nearest, and at least 1 while it runs; null once it has ended. */
export function fanMinutesLeft(until: string | null | undefined, now = Date.now()) {
  const left = until ? Date.parse(until) - now : Number.NaN;
  return left > 0 ? Math.max(1, Math.round(left / 60_000)) : null;
}
