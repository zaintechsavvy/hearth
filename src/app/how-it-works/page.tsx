import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getUser } from "@/lib/session";
import { DIAGRAMS } from "./diagrams";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "How it works",
  description: "How your screens, Hearth, the database, Home Assistant, and your devices fit together.",
};

/** Each idea, the words for it, and its diagram in `diagrams.tsx` under the same id. */
const SECTIONS = [
  {
    id: "connects", title: "How Hearth connects",
    body: "Hearth is one app. Your phone, laptop, and wall tablet only ever talk to Hearth; Hearth talks to Home Assistant, the Matter Server, your cameras, and the services you add, so tokens and passwords never reach a browser.",
  },
  {
    id: "runs", title: "Where Hearth runs",
    body: "The same code runs hosted on Vercel or at home in Docker. Hosted, Hearth reaches Home Assistant over the internet, through a Tailscale Funnel or Home Assistant Cloud. At home it reaches it on your own network, and a monitor stays awake for automations, alerts, and history.",
  },
  {
    id: "tap", title: "A tap, end to end",
    body: "A tile changes the moment you press it, before any answer comes back. Hearth checks who you are and what you may do, asks Home Assistant to make the change, and every open screen hears about it. If the device refuses, the tile goes back.",
  },
  {
    id: "live", title: "How every screen stays live",
    body: "Each page keeps one stream open. When anything changes, in Hearth, in Home Assistant's app, or at the switch on the wall, the home is rebuilt once and sent to every screen that is open.",
  },
  {
    id: "wall", title: "The wall tablet",
    body: "Turn a tablet into a wall display in its own settings. It keeps the screen on, rests on a large clock or your photos, dims to red at night, and wakes back on Home at a touch, when someone walks by, or when the doorbell rings.",
  },
  {
    id: "activity", title: "Activity, from both sides",
    body: "Hearth keeps its own log of who did what, and Home Assistant keeps a logbook of everything else. Activity merges the two, so a change made anywhere shows up once, with who made it.",
  },
  {
    id: "opening", title: "Who can open the home",
    body: "Unlocking a door, opening the garage, and disarming the alarm always ask a person first: hold the tile until its bar crosses, or enter the household PIN, whichever the owner chose. Automations, scenes, Good night, and the assistant can never do it.",
  },
  {
    id: "matter", title: "Two ways to reach Matter devices",
    body: "Matter devices can come through Home Assistant, with its names and rooms, or straight from a Matter Server. Both use the same server and the same pairing.",
  },
];

function Diagram({ id }: { id: keyof typeof DIAGRAMS }) {
  const Drawn = DIAGRAMS[id];
  return <Drawn />;
}

/**
 * A public tour of how Hearth works, one diagram per idea, everything aligned to one left edge. It always sits on the
 * plain backdrop, not the person's own photo or gradient, so its words read in the theme's colours with nothing behind them.
 */
export default async function HowItWorksPage() {
  const signedIn = Boolean(await getUser());
  return (
    <>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={styles.edgeTop} />
        <span className={styles.edgeBottom} />
      </div>
      <div className={styles.page}>
        <header className={`${styles.header} ${styles.card}`}>
          <Link href="/" aria-label="Hearth home"><Logo /></Link>
          <Link href={signedIn ? "/dashboard" : "/sign-in"} className={styles.signIn}>{signedIn ? "Open Hearth" : "Sign in"}</Link>
        </header>
        <main className={styles.main}>
          <div className={styles.intro}>
            <h1 className={styles.title}>How Hearth works</h1>
            <p className={styles.lede}>How your screens, Hearth, the database, Home Assistant, and your devices fit together.</p>
          </div>
          {SECTIONS.map(section => (
            <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-title`}>
              <div className={styles.copy}>
                <h2 id={`${section.id}-title`} className={styles.heading}>{section.title}</h2>
                <p className={styles.body}>{section.body}</p>
              </div>
              <Diagram id={section.id as keyof typeof DIAGRAMS} />
            </section>
          ))}
        </main>
      </div>
    </>
  );
}
