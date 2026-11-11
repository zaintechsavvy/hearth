/** Any part of an Arc slider's control: its thumbs, or the track and fill beside them. */
const CONTROL = "[data-thumb], div:has([data-thumb])";
/** How far a finger moves before its direction decides between scrolling the page and dragging the slider. */
const DECIDE_PX = 6;

/**
 * Keeps a finger scrolling past a slider from moving it. A touch on a slider is held back until it shows its
 * direction: up or down scrolls the page and never reaches the slider; sideways, or a tap, is handed to the slider as
 * its own press from where the finger first landed. A mouse goes straight through.
 */
export function guardSliderTouches() {
  let held: { id: number; x: number; y: number; target: EventTarget } | null = null;
  let replaying = false;

  const handOver = () => {
    if (!held) return;
    const { id, x, y, target } = held;
    held = null;
    // The browser has already given the finger to the element it landed on. When the slider takes it, that element
    // reports losing it, which the slider would read as the finger lifting, so that one report is kept from it.
    const swallow = (event: PointerEvent) => {
      if (event.pointerId !== id || event.target !== target) return;
      event.stopPropagation();
      document.removeEventListener("lostpointercapture", swallow, true);
    };
    if (target instanceof Element && target.hasPointerCapture(id)) document.addEventListener("lostpointercapture", swallow, true);
    replaying = true;
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true, pointerId: id, pointerType: "touch", isPrimary: true, clientX: x, clientY: y, button: 0, buttons: 1 }));
    replaying = false;
  };
  const down = (event: PointerEvent) => {
    if (replaying || event.pointerType !== "touch" || !(event.target instanceof Element) || !event.target.closest(CONTROL)) return;
    event.stopPropagation();
    held = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target };
  };
  const move = (event: PointerEvent) => {
    if (!held || event.pointerId !== held.id) return;
    const dx = Math.abs(event.clientX - held.x), dy = Math.abs(event.clientY - held.y);
    if (dx < DECIDE_PX && dy < DECIDE_PX) return event.stopPropagation();
    if (dx > dy) handOver();
    else held = null;
  };
  const up = (event: PointerEvent) => { if (held && event.pointerId === held.id) handOver(); };
  const cancel = (event: PointerEvent) => { if (held && event.pointerId === held.id) held = null; };

  document.addEventListener("pointerdown", down, true);
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", cancel, true);
  return () => {
    document.removeEventListener("pointerdown", down, true);
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", cancel, true);
  };
}
