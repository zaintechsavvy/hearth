"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { HardDrive, House, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/arc/button/button";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { Logo } from "@/components/brand/logo";
import { PreviewWindow } from "./preview-window";
import styles from "./landing.module.css";

const POINTS = [
  { icon: House, title: "Works with Home Assistant", body: "Bring in the lights, fans, and climate you already run." },
  { icon: Radio, title: "Speaks Matter", body: "Pair devices with a setup code through your Matter server." },
  { icon: Sparkles, title: "Ask in plain words", body: "Type or say \u201cturn on the bedroom fan\u201d with Claude, ChatGPT, Grok, Gemini, or Muse." },
  { icon: HardDrive, title: "Runs at home", body: "Self hosted. Tokens and camera passwords are encrypted at rest." },
];

export function Landing() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const rise = (delay: number): HTMLMotionProps<"div"> => reduce ? {} : {
    initial: { opacity: 0, y: 14, filter: `blur(${motionTokens.blur.soft}px)` },
    animate: { opacity: 1, y: 0, filter: "none" },
    transition: { duration: motionTokens.duration.considered * 1.4, delay, ease: [...motionTokens.ease.enter] },
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo />
        <nav className={styles.headerNav} aria-label="Account">
          <Link href="/sign-in" className={styles.textLink}>Sign in</Link>
        </nav>
      </header>

      <main className={styles.hero}>
        <motion.div className={styles.copy} {...rise(0)}>
          <h1 className={styles.title}>Build your home today.</h1>
          <p className={styles.lede}>
            Hearth gathers your thermostat, cameras, lights, and Matter devices into one calm dashboard you arrange yourself.
          </p>
          <div className={styles.actions}>
            <Button size="lg" className={styles.cta} onClick={() => router.push("/sign-up")}>Get started</Button>
            <Link href="/sign-in" className={styles.textLink}>I have an account</Link>
          </div>
          <ul className={styles.points}>
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className={styles.point}>
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <p className={styles.pointTitle}>{title}</p>
                  <p className={styles.pointBody}>{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div className={styles.preview} {...rise(0.12)}>
          <PreviewWindow />
        </motion.div>
      </main>
    </div>
  );
}
