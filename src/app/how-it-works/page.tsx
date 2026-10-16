import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Wallpaper } from "@/components/glass/wallpaper";
import { getUser } from "@/lib/session";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "How it works",
  description: "How your screens, Hearth, the database, Home Assistant, and your devices fit together, in pictures.",
};

/** Each diagram's file, its pixel size, and the words beside it. */
const SECTIONS = [
  {
    id: "connects", title: "How Hearth connects", image: "overview", width: 3360, height: 1980,
    body: "Hearth is one app. Your phone, laptop, and wall tablet only ever talk to Hearth; Hearth talks to Home Assistant, the Matter Server, your cameras, and the services you add, so tokens and passwords never reach a browser.",
  },
  {
    id: "runs", title: "Where Hearth runs", image: "hosting", width: 3360, height: 1720,
    body: "The same code runs hosted on Vercel or at home in Docker. Hosted, Hearth reaches Home Assistant over the internet, through a Tailscale Funnel or Home Assistant Cloud. At home it reaches it on your own network, and a monitor stays awake for automations, alerts, and history.",
  },
  {
    id: "tap", title: "A tap, end to end", image: "tap", width: 3360, height: 1160,
    body: "A tile changes the moment you press it, before any answer comes back. Hearth checks who you are and what you may do, asks Home Assistant to make the change, and every open screen hears about it. If the device refuses, the tile goes back.",
  },
  {
    id: "live", title: "How every screen stays live", image: "live", width: 3360, height: 1600,
    body: "Each page keeps one stream open. When anything changes, in Hearth, in Home Assistant's app, or at the switch on the wall, the home is rebuilt once and sent to every screen that is open.",
  },
  {
    id: "wall", title: "The wall tablet", image: "wall", width: 3360, height: 1640,
    body: "Turn a tablet into a wall display in its own settings. It keeps the screen on, rests on the date and a large clock in the colour and brightness you pick, dims to red at night, and wakes at a touch or when someone walks by.",
  },
  {
    id: "activity", title: "Activity, from both sides", image: "activity", width: 3360, height: 1440,
    body: "Hearth keeps its own log of who did what, and Home Assistant keeps a logbook of everything else. Activity merges the two, so a change made anywhere shows up once, with who made it.",
  },
  {
    id: "opening", title: "Who can open the home", image: "opening", width: 3360, height: 1560,
    body: "Unlocking a door, opening the garage, and disarming the alarm always ask first: hold the tile until its bar fills, or enter the household PIN, whichever the owner chose. Automations, scenes, and the assistant can never do it.",
  },
  {
    id: "matter", title: "Two ways to reach Matter devices", image: "matter", width: 3360, height: 1520,
    body: "Matter devices can come through Home Assistant, with its names and rooms, or straight from a Matter Server. Both use the same server and the same pairing.",
  },
];

/** A public tour of how Hearth works, one diagram per idea, everything aligned to one left edge. */
export default async function HowItWorksPage() {
  const signedIn = Boolean(await getUser());
  return (
    <>
      <Wallpaper />
      <div className={styles.page}>
        <header className={styles.header} data-on-wall>
          <Link href="/" aria-label="Hearth home"><Logo /></Link>
          <Link href={signedIn ? "/dashboard" : "/sign-in"} className={styles.signIn}>{signedIn ? "Open Hearth" : "Sign in"}</Link>
        </header>
        <main className={styles.main}>
          <div className={styles.intro} data-on-wall>
            <h1 className={styles.title}>How Hearth works</h1>
            <p className={styles.lede}>How your screens, Hearth, the database, Home Assistant, and your devices fit together.</p>
            <nav aria-label="On this page" className={styles.contents}>
              {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`} className={styles.contentsLink}>{section.title}</a>)}
            </nav>
          </div>
          {SECTIONS.map(section => (
            <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-title`}>
              <div className={styles.copy} data-on-wall>
                <h2 id={`${section.id}-title`} className={styles.heading}>{section.title}</h2>
                <p className={styles.body}>{section.body}</p>
              </div>
              <figure className={styles.figure}>
                <Image src={`/how-it-works/${section.image}.png`} alt={section.title} width={section.width} height={section.height} sizes="(max-width: 1160px) 100vw, 1120px" className={styles.image} />
              </figure>
            </section>
          ))}
        </main>
      </div>
    </>
  );
}
