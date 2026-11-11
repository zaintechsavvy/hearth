"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Shows a camera's frame full screen: the browser's own full screen where it has one, and otherwise, as in an iPad
 * home screen app or on an iPhone, the frame lifted into the top layer as a popover filling the window. The frame
 * stays where it is in the page, so a live stream keeps playing without reconnecting.
 */
export function useCameraFullScreen(frame: RefObject<HTMLElement | null>) {
  const [lifted, setLifted] = useState(false);

  const close = () => {
    const element = frame.current;
    if (element?.matches(":popover-open")) element.hidePopover();
    element?.removeAttribute("popover");
    setLifted(false);
  };

  const open = async () => {
    const element = frame.current;
    if (!element) return;
    if (document.fullscreenEnabled && typeof element.requestFullscreen === "function") {
      try {
        await element.requestFullscreen();
        return;
      } catch {
        // Refused, as some browsers do inside an installed app: fall back to filling the window.
      }
    }
    if (typeof element.showPopover !== "function") return;
    element.setAttribute("popover", "manual");
    element.showPopover();
    setLifted(true);
  };

  useEffect(() => {
    if (!lifted) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  return { lifted, open, close };
}
