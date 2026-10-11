"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import styles from "./auth-card.module.css";

interface AuthCardProps {
  title: string;
  description: string;
  footer: { prompt: string; href: "/sign-in" | "/sign-up"; label: string };
  children: ReactNode;
}

export function AuthCard({ title, description, footer, children }: AuthCardProps) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={styles.card}
      aria-labelledby="auth-title"
      initial={reduce ? false : { opacity: 0, y: 12, filter: `blur(${motionTokens.blur.soft}px)` }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: motionTokens.duration.considered, ease: [...motionTokens.ease.enter] }}
    >
      <div className={styles.heading}>
        <h1 id="auth-title" className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
      {children}
      <p className={styles.footer}>
        {footer.prompt} <Link href={footer.href} className={styles.link}>{footer.label}</Link>
      </p>
    </motion.section>
  );
}
