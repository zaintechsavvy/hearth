import { useEffect, useState } from "react";

/** The time, kept fresh every `everyMs`, for countdowns that only need to move by the minute. */
export function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(timer);
  }, [everyMs]);
  return now;
}
