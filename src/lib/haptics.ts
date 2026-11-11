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

/** How recently the page or a list may have scrolled for a touch to count as scrolling rather than a tap. */
const SCROLL_QUIET_MS = 250;
let scrolledAt = -Infinity;
let watchingScroll = false;

/**
 * Lays an invisible switch over each `[data-haptic]` control under `root`, so a tap on it ticks on an iPhone. The tap
 * toggles the switch, then is handed to the control as its own click, so links and buttons behave as before.
 */
export function addTapSwitches(root: ParentNode) {
  if (!watchingScroll) {
    watchingScroll = true;
    document.addEventListener("scroll", () => { scrolledAt = performance.now(); }, { capture: true, passive: true });
  }
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
    // A finger that scrolled can still end in a click on the switch. The tile never hears of it, but the switch is left
    // to flip: cancelling a switch's click on iOS holds the touch and stops the page scrolling.
    input.addEventListener("click", event => {
      event.stopPropagation();
      if (performance.now() - scrolledAt < SCROLL_QUIET_MS) return;
      switchedAt = performance.now();
      if (!host.matches(":disabled")) host.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    host.append(input);
  }
}

export function removeTapSwitches() {
  for (const input of document.querySelectorAll(`[${SWITCH_ATTR}]`)) input.remove();
}
