/** This device's choice, stored as JSON; anything but false keeps haptics on. */
export const HAPTICS_KEY = "hearth-haptics";
const PATTERNS = { tap: 10, press: 18, success: [14, 60, 22], alert: [60, 80, 60, 80, 120] } satisfies Record<string, number | number[]>;
export type Haptic = keyof typeof PATTERNS;

/**
 * A short buzz under the finger. Android vibrates; iPhone Safari has no vibration, so iOS 18 and later get the tick of
 * a hidden switch instead, which only fires during a tap. Elsewhere it does nothing.
 */
export function haptic(kind: Haptic = "tap") {
  if (typeof navigator === "undefined" || localStorage.getItem(HAPTICS_KEY) === "false") return;
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(PATTERNS[kind]);
    return;
  }
  if (!/iPhone|iPad/.test(navigator.userAgent) && !(navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))) return;
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
