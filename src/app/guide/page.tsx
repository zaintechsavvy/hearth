import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getUser } from "@/lib/session";
import base from "../how-it-works/page.module.css";
import { ArrangeVisual, ConnectVisual, FacesVisual, GoodNightVisual, WakeVisual, WallVisual } from "./visuals";
import styles from "./guide.module.css";

export const metadata: Metadata = {
  title: "Setting up Hearth",
  description: "From pairing Home Assistant to a tablet resting on the wall, one step at a time.",
};

const STEPS = [
  {
    id: "connect", title: "Pair Home Assistant", settings: "/settings#connections", visual: <ConnectVisual />,
    body: "Hearth reads your devices from the Home Assistant you already run, or straight from a Matter server. Nothing moves; your automations, names and history stay where they are.",
    points: ["Open Settings, then Connections, and choose Add.", "Paste your Home Assistant address and a long-lived access token from your Home Assistant profile.", "Lights, locks, the thermostat and cameras come straight in."],
  },
  {
    id: "arrange", title: "Arrange your home", settings: "/dashboard", visual: <ArrangeVisual />,
    body: "The home screen holds only what you put on it. Add what you reach for and lay it out the way the room works.",
    points: ["Choose Edit, then Add tile, and pick a device, a scene, or a widget like the weather.", "Drag tiles into place. Tap one while editing to pick its size, icon and colour.", "Pages and rooms along the top switch what the screen shows, and you can edit inside a room."],
  },
  {
    id: "wall", title: "Turn on wall tablet mode", settings: "/settings#wall", visual: <WallVisual />,
    body: "On the tablet itself, add Hearth to the home screen so it opens full screen, then open Settings, then Wall tablet, and switch it on. The menus step back, the screen stays awake and it dims at night.",
    points: ["On an iPad: Share, then Add to Home Screen.", "The clock and the menu sit in the corner; the menu has Good night, Rest the screen, and the way out.", "Hold anywhere on the background for quick actions, including Customize."],
  },
  {
    id: "rest", title: "Pick a resting screen", settings: "/settings#wall", visual: <FacesVisual />,
    body: "After a few quiet minutes the tablet rests on a clock you can read across the room. Each face takes its own colours: large digits you can stack and make bolder, an analog face, or a luxury dial shaped to the screen.",
    points: ["Pick the colour, or your own, and how bright it shows.", "Choose hand colours and whether the seconds tick, sweep or stay off.", "Lights, fans, locks and the garage play a short moment on the screen when they change while it rests."],
  },
  {
    id: "wake", title: "Wake it when someone needs it", settings: "/settings#wall", visual: <WakeVisual />,
    body: "A touch wakes the screen. It can also wake on its own, so the home is already showing when someone walks up to it.",
    points: ["Pick motion, presence or door sensors near the tablet in Wall tablet settings.", "The doorbell takes over the screen with the camera, then lets it rest again.", "At night the screen dims, and the clock can turn a soft red."],
  },
  {
    id: "night", title: "Set up Good night", settings: "/settings#bedtime", visual: <GoodNightVisual />,
    body: "Good night starts empty. Choose what one hold of it does: lock the doors, close the garage, turn off the lights, arm the alarm, and what it should only check.",
    points: ["Use the usual for a one-tap start, then adjust it.", "Keep devices it should never touch, and turn on a porch light for the night."],
  },
];

/** A walkthrough from a new account to a tablet resting on the wall, laid out like How it works, one picture per step. */
export default async function GuidePage() {
  const signedIn = Boolean(await getUser());
  return (
    <>
      <div className={base.backdrop} aria-hidden="true">
        <span className={base.edgeTop} />
        <span className={base.edgeBottom} />
      </div>
      <div className={base.page}>
        <header className={`${base.header} ${base.card}`}>
          <Link href="/" aria-label="Hearth home"><Logo /></Link>
          <Link href={signedIn ? "/dashboard" : "/sign-in"} className={base.signIn}>{signedIn ? "Open Hearth" : "Sign in"}</Link>
        </header>
        <main className={base.main}>
          <div className={base.intro}>
            <h1 className={base.title}>Setting up Hearth</h1>
            <p className={base.lede}>From pairing Home Assistant to a tablet resting on the wall, one step at a time.</p>
            <nav className={styles.jump} aria-label="Steps">
              {STEPS.map((step, index) => <a key={step.id} href={`#${step.id}`} className={styles.jumpLink}><span className={styles.number}>{index + 1}</span>{step.title}</a>)}
            </nav>
          </div>
          {STEPS.map((step, index) => (
            <section key={step.id} id={step.id} className={`${base.section} ${styles.step}`} aria-labelledby={`${step.id}-title`}>
              <div className={styles.copy}>
                <span className={styles.number} aria-hidden="true">{index + 1}</span>
                <h2 id={`${step.id}-title`} className={base.heading}>{step.title}</h2>
                <p className={base.body}>{step.body}</p>
                <ul className={styles.points}>{step.points.map(point => <li key={point}>{point}</li>)}</ul>
                {signedIn && <Link href={step.settings} className={styles.open}>{step.settings === "/dashboard" ? "Open the home screen" : "Open in Settings"}</Link>}
              </div>
              <div className={`${base.card} ${styles.figure}`}>{step.visual}</div>
            </section>
          ))}
        </main>
      </div>
    </>
  );
}
