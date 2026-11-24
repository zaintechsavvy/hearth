"use client";

import { useEffect, useRef, useState } from "react";

/** Width over height of the element `ref` is attached to, kept current as it resizes; a tablet on its side until measured. */
export function useBoxAspect<T extends Element>() {
  const ref = useRef<T>(null);
  const [aspect, setAspect] = useState(1180 / 820);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.height) setAspect(entry.contentRect.width / entry.contentRect.height); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, aspect] as const;
}
