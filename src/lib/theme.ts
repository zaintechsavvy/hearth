export type ThemePreference = "light" | "dark" | "system";

export const ACCENTS = ["neutral", "blue", "violet", "rose", "coral", "orange", "amber", "green"] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "neutral";

export const WALLPAPERS = ["studio", "linen", "slate"] as const;
export type Wallpaper = (typeof WALLPAPERS)[number];
export const DEFAULT_WALLPAPER: Wallpaper = "studio";

export const THEME_KEY = "hearth-theme";
export const ACCENT_KEY = "hearth-accent";
export const WALLPAPER_KEY = "hearth-wallpaper";

/** Runs before first paint so the page never flashes the wrong theme. Keep it dependency free. */
export const THEME_BOOTSTRAP = `(()=>{try{var r=document.documentElement,s=localStorage,p=s.getItem("${THEME_KEY}")||"system",d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light";var a=s.getItem("${ACCENT_KEY}");if(a)r.dataset.accent=a;var w=s.getItem("${WALLPAPER_KEY}");if(w)r.dataset.wallpaper=w}catch(e){}})()`;
