"use client";

import { useRef, type MouseEvent, type PointerEvent } from "react";
import { haptic } from "@/lib/haptics";

const HOLD_MS = 450;
const SLOP_PX = 8;

/**
 * Press and hold, or right click, to open more controls. Moving the finger cancels, so sliders inside the tile
 * still drag, and the click that ends a hold is swallowed so the tile does not also toggle.
 */
export function useLongPress(onLongPress: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  if (!onLongPress) return {};
  const cancel = () => {
    clearTimeout(timer.current);
    start.current = null;
  };
  return {
    onPointerDownCapture: (event: PointerEvent) => {
      // Holding a level slider readies it to drag, so it never opens the tile's controls.
      if (event.button !== 0 || (event.target as Element).closest("[role=slider]")) return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        haptic("press");
        onLongPress();
      }, HOLD_MS);
    },
    onPointerMoveCapture: (event: PointerEvent) => {
      if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > SLOP_PX) cancel();
    },
    onPointerUpCapture: cancel,
    onPointerCancelCapture: cancel,
    onPointerLeave: cancel,
    onClickCapture: (event: MouseEvent) => {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault();
      cancel();
      onLongPress();
    },
  };
}
