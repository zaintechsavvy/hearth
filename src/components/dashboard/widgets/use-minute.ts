import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, 1000);
  return () => clearInterval(timer);
};
const minute = () => Math.floor(Date.now() / 60_000) * 60_000;

/** The current time, rounded to the minute and updated as it turns. Null during server rendering. */
export function useMinute(): number | null {
  const now = useSyncExternalStore(subscribe, minute, () => 0);
  return now === 0 ? null : now;
}
