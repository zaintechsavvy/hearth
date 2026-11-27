import { useCallback, useEffect, useRef, useState } from "react";

/** How long a change may wait for its answer before its button shows a spinner. */
const SLOW_MS = 1500;

/**
 * The latest change of each kind still waiting on its answer, by the option it chose, once it has waited long enough
 * to show a spinner. A newer change of the same kind takes over from an older one.
 */
export function usePending() {
  const [slow, setSlow] = useState<Record<string, string>>({});
  const latest = useRef(new Map<string, object>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const track = useCallback(<T,>(key: string, option: string, work: Promise<T>) => {
    const token = {};
    latest.current.set(key, token);
    const clear = () => setSlow(current => key in current ? Object.fromEntries(Object.entries(current).filter(([name]) => name !== key)) : current);
    clear();
    const timer = setTimeout(() => latest.current.get(key) === token && setSlow(current => ({ ...current, [key]: option })), SLOW_MS);
    timers.current.add(timer);
    const settle = () => {
      clearTimeout(timer);
      timers.current.delete(timer);
      if (latest.current.get(key) !== token) return;
      latest.current.delete(key);
      clear();
    };
    work.then(settle, settle);
    return work;
  }, []);

  return [slow, track] as const;
}
