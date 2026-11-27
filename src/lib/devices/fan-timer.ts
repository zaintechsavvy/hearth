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

/** The fan slider's stops: each duration, then the far end, where the fan runs until it is turned off. */
export const FAN_STOPS: (number | null)[] = [...FAN_TIMER_MINUTES, null];
export const UNTIL_OFF = FAN_STOPS.length - 1;

/** The stops labelled under the slider: 10m, 1h, 4h, 12h and the open end. */
export const FAN_MARKS = [0, 5, 7, 9, UNTIL_OFF];

export const fanStopLabel = (index: number) => {
  const minutes = FAN_STOPS[index];
  return minutes === null || minutes === undefined ? "Until I turn it off" : fanDuration(minutes);
};

export const fanStopMark = (index: number) => {
  const minutes = FAN_STOPS[index];
  return minutes === null || minutes === undefined ? "∞" : fanDuration(minutes).replace(" min", "m").replace(" h", "h");
};

/** The timed stop nearest a running timer's time left, so the slider opens where the timer is. */
export const nearestFanIndex = (minutes: number) =>
  FAN_TIMER_MINUTES.reduce((best, value, index) => Math.abs(value - minutes) < Math.abs(FAN_TIMER_MINUTES[best] - minutes) ? index : best, 0);
