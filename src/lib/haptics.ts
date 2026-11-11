/** This device's choice, stored as JSON; anything but false keeps haptics on. */
export const HAPTICS_KEY = "hearth-haptics";
const PATTERNS = { tap: 10, press: 18, success: [14, 60, 22], alert: [60, 80, 60, 80, 120] } satisfies Record<string, number | number[]>;
export type Haptic = keyof typeof PATTERNS;

const SWITCH_ATTR = "data-haptic-switch";
/** A tap that already ticked through a switch, so the click it becomes does not tick again. */
let switchedAt = -Infinity;

export const hapticsOn = () => localStorage.getItem(HAPTICS_KEY) !== "false";

/** iPhone and iPad Safari, which have no vibration and tick only for a switch. */
export const ticksWithSwitches = () => typeof navigator.vibrate !== "function"
  && (/iPhone|iPad/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

/**
 * A short buzz under the finger. Android vibrates. iPhone Safari has no vibration: up to iOS 26.4 it ticks for a hidden
 * switch toggled from code, which is tried here; from 26.5 only a finger on a real switch ticks, which `addTapSwitches` gives.
 */
export function haptic(kind: Haptic = "tap") {
  if (typeof navigator === "undefined" || !hapticsOn()) return;
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(PATTERNS[kind]);
    return;
  }
  if (!ticksWithSwitches() || performance.now() - switchedAt < 100) return;
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.append(input);
  document.head.append(label);
  label.click();
  label.remove();
}

/**
 * Lays an invisible switch over each `[data-haptic]` control under `root`, so a tap on it ticks on an iPhone. The tap
 * toggles the switch, then is handed to the control as its own click, so links and buttons behave as before.
 */
/** How far a finger may move on a control before the touch counts as scrolling. */
const SCROLL_SLOP_PX = 10;

export function addTapSwitches(root: ParentNode) {
  for (const host of root.querySelectorAll<HTMLElement>("[data-haptic]")) {
    if (host.querySelector(`:scope > [${SWITCH_ATTR}]`)) continue;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.setAttribute(SWITCH_ATTR, "");
    input.setAttribute("aria-hidden", "true");
    input.tabIndex = -1;
    input.style.cssText = "position:absolute;inset:0;z-index:1;width:100%;height:100%;margin:0;padding:0;border:0;-webkit-appearance:switch;appearance:auto;opacity:0;cursor:inherit";
    // An iOS switch also flips when a finger slides across it, so a touch that moved or scrolled the page is a scroll, not a tap.
    let touch: { x: number; y: number; scroll: number; moved: boolean } | null = null;
    input.addEventListener("touchstart", event => {
      const point = event.touches[0];
      touch = { x: point.clientX, y: point.clientY, scroll: scrollY, moved: false };
    }, { passive: true });
    input.addEventListener("touchmove", event => {
      const point = event.touches[0];
      if (touch && Math.hypot(point.clientX - touch.x, point.clientY - touch.y) > SCROLL_SLOP_PX) touch.moved = true;
    }, { passive: true });
    input.addEventListener("click", event => {
      event.stopPropagation();
      const scrolled = touch && (touch.moved || Math.abs(scrollY - touch.scroll) > SCROLL_SLOP_PX);
      touch = null;
      if (scrolled) {
        event.preventDefault();
        return;
      }
      switchedAt = performance.now();
      if (!host.matches(":disabled")) host.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    host.append(input);
  }
}

export function removeTapSwitches() {
  for (const input of document.querySelectorAll(`[${SWITCH_ATTR}]`)) input.remove();
}
