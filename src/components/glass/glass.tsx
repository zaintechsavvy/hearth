import type { ComponentPropsWithoutRef, ElementType } from "react";
import styles from "./glass.module.css";

type GlassProps<T extends ElementType> = {
  as?: T;
  shape?: "surface" | "panel" | "pill";
} & Omit<ComponentPropsWithoutRef<T>, "as">;

export function Glass<T extends ElementType = "div">({ as, shape = "surface", className, ...props }: GlassProps<T>) {
  const Component = as ?? "div";
  return <Component className={[styles.glass, styles[shape], className].filter(Boolean).join(" ")} {...props} />;
}

export const glassClass = (shape: "surface" | "panel" | "pill" = "surface") => `${styles.glass} ${styles[shape]}`;

export const glassSheetClass = styles.sheet;
