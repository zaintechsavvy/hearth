"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, BellRing, Hand, House, LayoutGrid, MoonStar, Plug, Radar, Tablet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { glassSheetClass } from "@/components/glass/glass";
import { DEFAULT_WALL, type WallSettings } from "@/lib/wall";
import { AnalogFace, useClockNow } from "./analog-face";
import { LuxuryFace } from "./luxury-face";
import styles from "./hearth-tour.module.css";

const TOUR_EVENT = "hearth-tour";
const SEEN_KEY = "hearth-tour-seen";
/** Opens the tour from anywhere: the welcome screen, the account menu, or Settings. */
export const startTour = () => window.dispatchEvent(new Event(TOUR_EVENT));
/** Opens it once, the first time a new home is seen on this device. */
export const startTourOnce = () => {
  if (localStorage.getItem(SEEN_KEY)) return;
  localStorage.setItem(SEEN_KEY, "1");
  startTour();
};

const faceSettings: WallSettings = { ...DEFAULT_WALL, clockColor: "blue", clockBrightness: 1, secondHand: "smooth" };

function Faces() {
  const now = useClockNow();
  return (
    <div className={styles.faces}>
      <figure className={styles.face}>
        <span className={styles.digital} aria-hidden="true">{now ? new Date(now).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, "") : ""}</span>
        <figcaption>Digital</figcaption>
      </figure>
      <figure className={styles.face}>
        <span className={styles.analog} aria-hidden="true"><AnalogFace inline night={false} settings={faceSettings} /></span>
        <figcaption>Analog</figcaption>
      </figure>
      <figure className={styles.face}>
        <span className={styles.luxury} aria-hidden="true"><LuxuryFace inline night={false} settings={{ ...faceSettings, clockColor: "green" }} /></span>
        <figcaption>Luxury</figcaption>
      </figure>
    </div>
  );
}

const Point = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => <li className={styles.point}><span className={styles.pointIcon} aria-hidden="true">{icon}</span><span>{children}</span></li>;

type Step = { title: string; body: string; visual?: ReactNode; points?: ReactNode; action?: { label: string; href: string } };

const STEPS: Step[] = [
  {
    title: "Welcome to Hearth",
    body: "A calm home screen for a tablet on the wall, built on the Home Assistant you already run. Here is how to get from a new account to a screen the whole household uses.",
    visual: <span className={styles.hero}><House size={40} strokeWidth={1.5} /></span>,
  },
  {
    title: "Pair Home Assistant",
    body: "Hearth reads your devices from Home Assistant, or from a Matter server. Nothing moves; your automations and history stay where they are.",
    points: <>
      <Point icon={<Plug size={16} strokeWidth={1.75} />}>Open Settings, then Connections, and choose Add.</Point>
      <Point icon={<span className={styles.num}>2</span>}>Paste your Home Assistant address and a long-lived access token from your Home Assistant profile.</Point>
      <Point icon={<span className={styles.num}>3</span>}>Your lights, locks, thermostat and cameras come straight in.</Point>
    </>,
    action: { label: "Open Connections", href: "/settings#connections" },
  },
  {
    title: "Arrange your home",
    body: "The home screen holds only what you put on it. Add what you reach for most and lay it out the way the room works.",
    points: <>
      <Point icon={<LayoutGrid size={16} strokeWidth={1.75} />}>Choose Edit, then Add tile, and pick a device, a scene, or a widget like the weather.</Point>
      <Point icon={<Hand size={16} strokeWidth={1.75} />}>Drag tiles into place, and tap a tile while editing to pick its size, icon and colour.</Point>
      <Point icon={<House size={16} strokeWidth={1.75} />}>Rooms along the top filter the screen, and you can edit right inside one.</Point>
    </>,
  },
  {
    title: "Turn on wall tablet mode",
    body: "On the tablet itself, open Settings, then Wall tablet, and switch it on. The menus step back, the screen stays awake, and it dims at night.",
    points: <>
      <Point icon={<Tablet size={16} strokeWidth={1.75} />}>Add Hearth to the home screen first (Share, then Add to Home Screen on an iPad) so it opens full screen.</Point>
      <Point icon={<span className={styles.num}>⋯</span>}>The menu in the corner, beside the clock, has Good night, Rest the screen, and the way out.</Point>
    </>,
    action: { label: "Open Wall tablet settings", href: "/settings#wall" },
  },
  {
    title: "Pick a resting screen",
    body: "After a few quiet minutes the tablet rests on a clock you can read across the room. Choose its face, colours, hands, and whether the seconds tick or sweep.",
    visual: <Faces />,
  },
  {
    title: "Wake it and get around",
    body: "The resting screen wakes as soon as someone needs it.",
    points: <>
      <Point icon={<Hand size={16} strokeWidth={1.75} />}>A touch wakes it. Holding the background shrinks the page and shows quick actions: Customize, Good night, and more.</Point>
      <Point icon={<Radar size={16} strokeWidth={1.75} />}>Pick motion, presence or door sensors in Wall tablet settings to wake it when someone walks by.</Point>
      <Point icon={<BellRing size={16} strokeWidth={1.75} />}>The doorbell takes over the screen with the camera, then lets it rest again.</Point>
      <Point icon={<MoonStar size={16} strokeWidth={1.75} />}>At night it dims, and the clock can turn a soft red.</Point>
    </>,
  },
];

/** A short tour from pairing Home Assistant to a tablet resting on the wall. */
export function HearthTour() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const show = () => { setIndex(0); setOpen(true); };
    window.addEventListener(TOUR_EVENT, show);
    return () => window.removeEventListener(TOUR_EVENT, show);
  }, []);

  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const go = (next: number) => { setDirection(Math.sign(next - index) || 1); setIndex(next); };
  const finish = () => { localStorage.setItem(SEEN_KEY, "1"); setOpen(false); };

  return (
    <Dialog open={open} onOpenChange={next => (next ? setOpen(true) : finish())}>
      <DialogContent className={`${glassSheetClass} ${styles.tour}`} title={step.title} description={`Step ${index + 1} of ${STEPS.length}`}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div key={index} className={styles.step}
            initial={reduce ? false : { opacity: 0, x: 24 * direction }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -24 * direction }}
            transition={{ duration: reduce ? 0 : 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
            {step.visual}
            <p className={styles.body}>{step.body}</p>
            {step.points && <ul className={styles.points}>{step.points}</ul>}
            {step.action && (
              <Button variant="secondary" className={styles.action} onClick={() => { finish(); router.push(step.action!.href); }}>
                {step.action.label}<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </Button>
            )}
          </motion.div>
        </AnimatePresence>
        <div className={styles.footer}>
          <div className={styles.dots} role="tablist" aria-label="Tour steps">
            {STEPS.map((item, i) => (
              <button key={item.title} type="button" role="tab" aria-selected={i === index} aria-label={item.title} className={styles.dot} onClick={() => go(i)} />
            ))}
          </div>
          <div className={styles.buttons}>
            {index > 0 ? <Button variant="ghost" onClick={() => go(index - 1)}>Back</Button> : <Button variant="ghost" onClick={finish}>Skip</Button>}
            <Button onClick={() => (last ? finish() : go(index + 1))}>{last ? "Done" : "Next"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
