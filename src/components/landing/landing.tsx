"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { Logo } from "@/components/brand/logo";
import { MomentPreview, type MomentPreviewScene } from "@/components/shell/device-moment";
import { useRouter } from "next/navigation";
import ipad from "./shots/ipad.webp";
import ipadDark from "./shots/ipad-dark.webp";
import analog from "./shots/wall-analog.webp";
import analogWarm from "./shots/wall-analog-warm.webp";
import thermostat from "./shots/thermostat-cool.webp";
import thermostatDark from "./shots/thermostat-cool-dark.webp";
import activity from "./shots/activity.webp";
import activityDark from "./shots/activity-dark.webp";
import customize from "./shots/customize.webp";
import customizeDark from "./shots/customize-dark.webp";
import phone from "./shots/phone.webp";
import phoneDark from "./shots/phone-dark.webp";
import { ConnectsDiagram } from "@/app/how-it-works/diagrams";
import styles from "./landing.module.css";

const GITHUB = "https://github.com/zaintechsavvy/hearth";

const MOMENTS: { scene: MomentPreviewScene; name: string }[] = [
  { scene: "light", name: "A lamp" }, { scene: "chandelier", name: "The chandelier" }, { scene: "fan", name: "A ceiling fan" }, { scene: "standingFan", name: "A standing fan" },
  { scene: "lock", name: "The front door lock" }, { scene: "garage", name: "The garage door" }, { scene: "door", name: "A door" }, { scene: "window", name: "A window" },
];

const FEATURES: { title: string; body: string; points: string[]; shot: StaticImageData; dark: StaticImageData; alt: string; small?: boolean; radius?: string }[] = [
  {
    title: "A grid you arrange yourself",
    body: "Start empty and add what you reach for. Drag tiles into any cell, gaps and all, and pick a size from 1×1 to 4×3. No YAML.",
    points: ["Lights, locks, garage doors, cameras, climate, scenes", "Each screen width keeps its own layout", "Swipe between rooms on a tablet"],
    shot: customize,
    dark: customizeDark,
    alt: "The customize dialog for a tile, with size, icon, colour and press actions",
  },
  {
    title: "Climate you can feel",
    body: "The thermostat glows warm from the top when you raise it and cool from the bottom when you lower it, and stays softly lit while the system runs.",
    points: ["Heat, cool and auto with one tap", "History chart one press away", "Celsius or Fahrenheit"],
    shot: thermostat,
    dark: thermostatDark,
    alt: "The thermostat tile glowing cool while cooling",
    small: true,
    radius: "12.06%",
  },
  {
    title: "What happened, and who did it",
    body: "Activity lists every change from Hearth and Home Assistant alike, even while no screen was open. Noisy devices fold into one line you can open.",
    points: ["Credits the person, scene or automation", "Doorbell rings come with a picture", "Mute a device that talks too much"],
    shot: activity,
    dark: activityDark,
    alt: "The Activity page grouping changes by day",
  },
  {
    title: "Fits in your pocket too",
    body: "The same home on your phone, with the same tiles. Add it to your home screen and it opens like an app.",
    points: ["Pages and rooms you can swipe", "Ask by typing or speaking", "Guests can be invited with a code"],
    shot: phone,
    dark: phoneDark,
    alt: "Hearth on a phone showing rooms and tiles",
    small: true,
  },
];

const FAQS: [string, string][] = [
  ["Why not the default Home Assistant dashboard, Mushroom, or Bubble Card?", "Those are great if you enjoy building cards in YAML. Hearth is for a screen the whole household uses: you arrange it by dragging, it rests as a clock, the doorbell takes over the screen, and nothing needs editing in a text file."],
  ["Does it replace Home Assistant?", "No. Hearth sits on top of the Home Assistant you already run and talks to it over its API. Your automations, devices and history stay where they are."],
  ["Does it need the cloud?", "No. It runs on your own server or a small machine at home. Nothing is sent anywhere except to your Home Assistant, and to an AI provider only if you turn on asking in plain words."],
  ["What tablets work?", "Any recent browser. An iPad or Android tablet on the wall is the main target; add it to the home screen, turn on wall mode in Settings, and set the tablet to never lock."],
  ["Is it free?", "Yes. Hearth is open source under the MIT license."],
];

export function Landing() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const rise = (delay = 0): HTMLMotionProps<"div"> => reduce ? {} : {
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: motionTokens.duration.considered * 1.4, delay, ease: [...motionTokens.ease.enter] },
  };

  return (
    <div className={styles.page}>
      <header className={styles.header} data-on-wall>
        <Logo />
        <nav className={styles.headerNav} aria-label="Site">
          <Link href="/how-it-works" className={styles.textLink}>How it works</Link>
          <a href={GITHUB} className={styles.textLink} target="_blank" rel="noreferrer">GitHub</a>
          <Link href="/sign-in" className={styles.textLink}>Sign in</Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <motion.div className={styles.copy} data-on-wall {...rise()}>
            <h1 className={styles.title}>Home controls, <em className={styles.highlight}>beautifully calm.</em></h1>
            <p className={styles.lede}>
              A self-hosted Home Assistant dashboard, made for a tablet on the wall.
            </p>
            <div className={styles.actions}>
              <Button size="lg" onClick={() => router.push("/sign-up")}>Try the demo home</Button>
              <a href={GITHUB} className={styles.ghost} target="_blank" rel="noreferrer">View on GitHub</a>
            </div>
            <p className={styles.meta}>Free and open source · MIT · Runs on your own server</p>
          </motion.div>

          <motion.div className={styles.tablet} {...rise(0.1)}>
            <div className={styles.bezel}>
              <Image unoptimized src={ipad} alt="Hearth on a wall tablet: thermostat, transit, music, locks, a porch camera, lights and who is home" priority className={`${styles.screen} ${styles.lightOnly}`} sizes="(min-width: 1200px) 1100px, 92vw" />
              <Image unoptimized src={ipadDark} alt="" aria-hidden="true" loading="eager" className={`${styles.screen} ${styles.darkOnly}`} sizes="(min-width: 1200px) 1100px, 92vw" />
            </div>
          </motion.div>
        </section>

        <section className={styles.rest}>
          <motion.div className={styles.restCopy} {...rise()}>
            <h2 className={styles.heading}>When nobody is looking</h2>
            <p className={styles.body}>
              After a few quiet minutes the wall tablet rests on a clock you can read across the room: an analog face in the colour you pick, or large digits. It dims at night, and wakes when someone walks by or rings the bell.
            </p>
            <ul className={styles.points}>
              <li>Analog or digital, in the colour and brightness you pick</li>
              <li>Night dim, and an optional red clock after dark</li>
              <li>A photo frame from your own pictures or Immich</li>
              <li>Wakes on motion, a door opening, or the doorbell</li>
            </ul>
          </motion.div>
          <motion.div className={styles.restShots} {...rise(0.1)}>
            <Image unoptimized src={analog} alt="The wall tablet resting on an analog face: large overlapping numerals behind white hands" className={styles.restShot} sizes="(min-width: 900px) 560px, 92vw" />
            <Image unoptimized src={analogWarm} alt="The analog face in a warm colour" className={`${styles.restShot} ${styles.restShotBack}`} sizes="(min-width: 900px) 420px, 70vw" />
          </motion.div>
        </section>

        <section className={styles.moments}>
          <motion.div className={styles.momentsCopy} {...rise()}>
            <h2 className={styles.heading}>When something changes</h2>
            <p className={styles.body}>
              When someone switches a light, a fan, or a lock from another room, the wall tablet shows it happening, full screen, then goes back to what it was showing. A change made on the tablet itself plays on its own tile.
            </p>
          </motion.div>
          <motion.ul className={styles.momentGrid} {...(rise(0.1) as HTMLMotionProps<"ul">)}>
            {MOMENTS.map(({ scene, name }) => (
              <li key={scene} className={styles.momentCard}>
                <span className={styles.momentArt}><MomentPreview scene={scene} /></span>
                <span className={styles.momentName}>{name}</span>
              </li>
            ))}
          </motion.ul>
        </section>

        <section className={styles.features} aria-label="Features">
          {FEATURES.map((f, i) => (
            <motion.article key={f.title} className={`${styles.feature} ${i % 2 ? styles.flip : ""}`} {...(rise() as HTMLMotionProps<"article">)}>
              <div className={styles.featureCopy}>
                <h2 className={styles.heading}>{f.title}</h2>
                <p className={styles.body}>{f.body}</p>
                <ul className={styles.points}>{f.points.map(p => <li key={p}>{p}</li>)}</ul>
              </div>
              <div className={`${styles.featureShot} ${f.small ? styles.featureShotSmall : ""} ${f.radius ? styles.featureShotRound : ""}`} style={f.radius ? { "--shot-radius": f.radius } as CSSProperties : undefined}>
                <Image unoptimized src={f.shot} alt={f.alt} className={`${styles.shot} ${styles.lightOnly}`} sizes="(min-width: 900px) 760px, 92vw" />
                <Image unoptimized src={f.dark} alt="" aria-hidden="true" className={`${styles.shot} ${styles.darkOnly}`} sizes="(min-width: 900px) 760px, 92vw" />
              </div>
            </motion.article>
          ))}
        </section>

        <section className={styles.how}>
          <motion.div className={styles.howCopy} {...rise()}>
            <h2 className={styles.heading}>How it works</h2>
            <p className={styles.body}>Your screens only talk to Hearth. Hearth talks to Home Assistant, Matter and your cameras, keeps its own database, and pushes every change to each screen the moment it happens.</p>
            <Link href="/how-it-works" className={styles.ghost}>See how it fits together</Link>
          </motion.div>
          <motion.div className={styles.howShot} {...rise(0.08)}>
            <ConnectsDiagram />
          </motion.div>
        </section>

        <section className={styles.host}>
          <motion.div {...rise()}>
            <h2 className={styles.heading}>Runs on your own server</h2>
            <p className={styles.body}>Docker Compose brings up Hearth, a Postgres database and the go2rtc camera relay. Point it at your Home Assistant and open it on any screen in the house.</p>
          </motion.div>
          <motion.pre className={styles.code} {...(rise(0.08) as HTMLMotionProps<"pre">)}>
{`git clone ${GITHUB}
cd hearth
cp .env.example .env
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env
docker compose up -d`}
          </motion.pre>
          <p className={styles.meta}>Prefer a hosted database? Hearth also runs on Vercel with Neon or Supabase. See the README.</p>
        </section>

        <section className={styles.faq}>
          <h2 className={styles.heading}>Questions</h2>
          <dl className={styles.faqList}>
            {FAQS.map(([q, a]) => (
              <div key={q} className={styles.faqItem}>
                <dt className={styles.faqQ}>{q}</dt>
                <dd className={styles.body}>{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.final} data-on-wall>
          <h2 className={styles.finalTitle}>Make the wall the calmest screen in the house.</h2>
          <div className={styles.actions}>
            <Button size="lg" onClick={() => router.push("/sign-up")}>Try the demo home</Button>
            <a href={GITHUB} className={styles.ghost} target="_blank" rel="noreferrer">View on GitHub</a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Logo />
        <span>MIT license · <a href={GITHUB} className={styles.textLink} target="_blank" rel="noreferrer">Source on GitHub</a></span>
      </footer>
    </div>
  );
}
