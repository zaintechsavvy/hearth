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
/** How far a finger may travel on a control and still count as a tap. */
const TAP_SLOP_PX = 10;
let scrolledAt = -Infinity;
/** The current or last touch: whether it wandered or the browser took it over to scroll. */
let touch = { x: 0, y: 0, strayed: false };
let watchingScroll = false;

/**
 * Lays an invisible label over each `[data-haptic]` control under `root`, wired to a hidden switch inside it, so a tap
 * on the control ticks on an iPhone: a real tap on a switch's label still toggles it as the finger's own act, which
 * is what iOS 26.5 ticks for. The tap is then handed to the control as its own click, so links and buttons behave as
 * before. The finger never lands on the switch itself: a switch claims every touch that starts on it to drag its
 * thumb, which no CSS can undo, and the page could not scroll from the control.
 */
export function addTapSwitches(root: ParentNode) {
  if (!watchingScroll) {
    watchingScroll = true;
    const quiet = { capture: true, passive: true };
    document.addEventListener("scroll", () => { scrolledAt = performance.now(); }, quiet);
    document.addEventListener("pointerdown", event => { touch = { x: event.clientX, y: event.clientY, strayed: false }; }, quiet);
    document.addEventListener("pointermove", event => { if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > TAP_SLOP_PX) touch.strayed = true; }, quiet);
    document.addEventListener("pointercancel", () => { touch.strayed = true; }, quiet);
  }
  for (const host of root.querySelectorAll<HTMLElement>("[data-haptic]")) {
    if (host.querySelector(`:scope > [${SWITCH_ATTR}]`)) continue;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const label = document.createElement("label");
    label.setAttribute(SWITCH_ATTR, "");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:absolute;inset:0;z-index:1;margin:0;padding:0;cursor:inherit;touch-action:pan-y;-webkit-tap-highlight-color:transparent";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    input.style.cssText = "position:absolute;width:1px;height:1px;margin:0;padding:0;border:0;opacity:0;pointer-events:none";
    // The switch's own click, which the label's sets off, stays inside: only the label's reaches the control.
    input.addEventListener("click", event => event.stopPropagation());
    label.addEventListener("click", event => {
      if (event.target !== label) return;
      event.stopPropagation();
      // A tap that slid or scrolled is not a tap; the switch may still flip, but the control never hears of it.
      if (touch.strayed || performance.now() - scrolledAt < SCROLL_QUIET_MS) return;
      switchedAt = performance.now();
      if (!host.matches(":disabled")) host.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    label.append(input);
    host.append(label);
  }
}

export function removeTapSwitches() {
  for (const input of document.querySelectorAll(`[${SWITCH_ATTR}]`)) input.remove();
}
