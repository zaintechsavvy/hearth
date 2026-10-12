export type ThemePreference = "light" | "dark" | "system";

export const ACCENTS = ["neutral", "blue", "violet", "rose", "coral", "orange", "amber", "green"] as const;
export type Accent = (typeof ACCENTS)[number];
export const DEFAULT_ACCENT: Accent = "neutral";

export const STILL_WALLPAPERS = ["studio", "linen", "slate"] as const;
export const MESH_WALLPAPERS = ["aurora", "dusk", "meadow"] as const;
export const PRESET_WALLPAPERS = [...STILL_WALLPAPERS, ...MESH_WALLPAPERS] as const;
/** `gradient` and `photo` are the person's own, described by `GRADIENT_KEY` and `PHOTO_KEY`. */
export const WALLPAPERS = [...PRESET_WALLPAPERS, "gradient", "photo"] as const;
export type Wallpaper = (typeof WALLPAPERS)[number];
export type PresetWallpaper = (typeof PRESET_WALLPAPERS)[number];
export type MeshWallpaper = (typeof MESH_WALLPAPERS)[number];

export interface CustomGradient {
  id: string;
  name: string;
  /** Two to five colours as #rrggbb. */
  colors: string[];
  /** 0 holds still, 1 drifts briskly. */
  motion: number;
  /** 0 keeps soft blobs, 1 folds them into swirls. */
  swirl: number;
  /** 0 is smooth, 1 is wavy. */
  distortion: number;
  grain: boolean;
  /** Darken the colours in dark mode so pastel palettes do not glare at night. */
  dimAtNight: boolean;
  /** The darkened colours, worked out when saved so the bootstrap script can paint them before any code loads. */
  night?: string[];
}

export interface PhotoBackground {
  id: string;
  /** Pixels of blur, 0 to 24. */
  blur: number;
  /** 0 to 0.7, how much the photo is darkened or lightened behind the glass. */
  dim: number;
}

export const MAX_GRADIENT_COLORS = 5;
export const GRADIENT_KEY = "hearth-gradient";
export const GRADIENTS_KEY = "hearth-gradients";
export const PHOTO_KEY = "hearth-photo";

/** Starting points for the gradient studio; each can be edited freely. */
export const GRADIENT_PALETTES: { name: string; colors: string[] }[] = [
  { name: "Lagoon", colors: ["#d4f1f4", "#75e6da", "#189ab4", "#a7c7e7"] },
  { name: "Peach", colors: ["#ffe5d9", "#ffcad4", "#f4acb7", "#fff1e6"] },
  { name: "Nebula", colors: ["#e0c3fc", "#8ec5fc", "#c2a0f7", "#f9d5ff"] },
  { name: "Citrus", colors: ["#fff3b0", "#ffd166", "#ffadad", "#caffbf"] },
  { name: "Mint", colors: ["#e8f8f5", "#b8f2e6", "#aed9e0", "#d8f3dc"] },
  { name: "Ember", colors: ["#ffd6a5", "#ff9b85", "#ff6b6b", "#ffc9de"] },
  { name: "Glacier", colors: ["#eef4ff", "#c9d6ff", "#e2e2e2", "#b8c6db"] },
  { name: "Midnight", colors: ["#141e30", "#243b55", "#3a1c71", "#1f4068"] },
];

export const DEFAULT_GRADIENT: CustomGradient = {
  id: "default", name: "My gradient", colors: GRADIENT_PALETTES[2].colors, motion: 0.3, swirl: 0.35, distortion: 0.8, grain: false, dimAtNight: true,
};
export const DEFAULT_WALLPAPER: Wallpaper = "studio";

export const isMesh = (wallpaper: Wallpaper): wallpaper is MeshWallpaper => (MESH_WALLPAPERS as readonly string[]).includes(wallpaper);

/** Soft, low-chroma palettes, so text on glass stays legible over every part of the gradient. */
export const MESH_PALETTES: Record<MeshWallpaper, { light: string[]; dark: string[] }> = {
  aurora: { light: ["#dfe7ff", "#c3d0fb", "#cdeee9", "#ecdfff"], dark: ["#0c1430", "#1f2f66", "#0f3f45", "#33225a"] },
  dusk: { light: ["#ffe6d8", "#fbcfd2", "#efd9fb", "#ffecc9"], dark: ["#26121a", "#552235", "#36204d", "#4f3018"] },
  meadow: { light: ["#e3f3df", "#cbe9da", "#f1efd2", "#d6e7f2"], dark: ["#0d1f16", "#1b4430", "#373f17", "#12303b"] },
};

export const WALLPAPER_LABELS: Record<PresetWallpaper, { name: string; note: string }> = {
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

/** Runs before first paint so the page never flashes the wrong theme or backdrop. Keep it dependency free. */
export const THEME_BOOTSTRAP = `(()=>{try{var r=document.documentElement,s=localStorage,p=s.getItem("${THEME_KEY}")||"system",d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light";var a=s.getItem("${ACCENT_KEY}");if(a)r.dataset.accent=a;var w=s.getItem("${WALLPAPER_KEY}");if(w)r.dataset.wallpaper=w;if(w==="gradient"){var g=JSON.parse(s.getItem("${GRADIENT_KEY}")||"null");var c=g&&(d&&g.dimAtNight&&g.night||g.colors);if(c&&c.length)for(var i=0;i<4;i++)r.style.setProperty("--m"+(i+1),c[i%c.length])}if(w==="photo"){var f=JSON.parse(s.getItem("${PHOTO_KEY}")||"null");if(f&&/^[\\w-]+$/.test(f.id)){r.style.setProperty("--photo","url(/api/backgrounds/"+f.id+")");r.style.setProperty("--photo-blur",(+f.blur||0)+"px");r.style.setProperty("--photo-dim",String(+f.dim||0))}}}catch(e){}})()`;
