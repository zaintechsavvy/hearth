export type ThemePreference = "light" | "dark" | "system";

export const ACCENTS = ["neutral", "blue", "violet", "rose", "coral", "orange", "amber", "green"] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "neutral";

export const STILL_WALLPAPERS = ["studio", "linen", "slate"] as const;
export const MESH_WALLPAPERS = ["aurora", "dusk", "meadow"] as const;
export const WALLPAPERS = [...STILL_WALLPAPERS, ...MESH_WALLPAPERS] as const;
export type Wallpaper = (typeof WALLPAPERS)[number];
export type MeshWallpaper = (typeof MESH_WALLPAPERS)[number];
export const DEFAULT_WALLPAPER: Wallpaper = "studio";

export const isMesh = (wallpaper: Wallpaper): wallpaper is MeshWallpaper => (MESH_WALLPAPERS as readonly string[]).includes(wallpaper);

/** Soft, low-chroma palettes, so text on glass stays legible over every part of the gradient. */
export const MESH_PALETTES: Record<MeshWallpaper, { light: string[]; dark: string[] }> = {
  aurora: { light: ["#dfe7ff", "#c3d0fb", "#cdeee9", "#ecdfff"], dark: ["#0c1430", "#1f2f66", "#0f3f45", "#33225a"] },
  dusk: { light: ["#ffe6d8", "#fbcfd2", "#efd9fb", "#ffecc9"], dark: ["#26121a", "#552235", "#36204d", "#4f3018"] },
  meadow: { light: ["#e3f3df", "#cbe9da", "#f1efd2", "#d6e7f2"], dark: ["#0d1f16", "#1b4430", "#373f17", "#12303b"] },
};

export const WALLPAPER_LABELS: Record<Wallpaper, { name: string; note: string }> = {
  studio: { name: "Studio", note: "Neutral grey" },
  linen: { name: "Linen", note: "Warm stone" },
  slate: { name: "Slate", note: "Cool blue grey" },
  aurora: { name: "Aurora", note: "Drifting blue" },
  dusk: { name: "Dusk", note: "Drifting peach" },
  meadow: { name: "Meadow", note: "Drifting sage" },
};

export const THEME_KEY = "hearth-theme";
export const ACCENT_KEY = "hearth-accent";
export const WALLPAPER_KEY = "hearth-wallpaper";

/** Runs before first paint so the page never flashes the wrong theme. Keep it dependency free. */
export const THEME_BOOTSTRAP = `(()=>{try{var r=document.documentElement,s=localStorage,p=s.getItem("${THEME_KEY}")||"system",d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light";var a=s.getItem("${ACCENT_KEY}");if(a)r.dataset.accent=a;var w=s.getItem("${WALLPAPER_KEY}");if(w)r.dataset.wallpaper=w}catch(e){}})()`;
