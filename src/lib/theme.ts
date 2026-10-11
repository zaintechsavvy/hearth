export type ThemePreference = "light" | "dark" | "system";

export const ACCENTS = ["orange", "amber", "coral", "rose", "violet", "blue", "green", "neutral"] as const;
export type Accent = (typeof ACCENTS)[number];

export const THEME_KEY = "hearth-theme";
export const ACCENT_KEY = "hearth-accent";

/** Runs before first paint so the page never flashes the wrong theme. Keep it dependency free. */
export const THEME_BOOTSTRAP = `(()=>{try{var r=document.documentElement,p=localStorage.getItem("${THEME_KEY}")||"system",d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light";var a=localStorage.getItem("${ACCENT_KEY}");if(a)r.dataset.accent=a}catch(e){}})()`;
