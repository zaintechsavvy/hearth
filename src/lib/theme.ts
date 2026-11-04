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

export type GradientStyle = "smooth" | "flowing";

export interface CustomGradient {
  id: string;
  name: string;
  /** Two or three colours as #rrggbb, top first. */
  colors: string[];
  /** A still top-to-bottom blend, or a slowly moving mesh. Gradients saved before styles existed are flowing. */
  style?: GradientStyle;
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

/** The background as one device saved it for the others; `savedAt` is the server's clock, so the newest wins. */
export interface SyncedBackground {
  wallpaper: Wallpaper;
  gradient: CustomGradient | null;
  gradients: CustomGradient[];
  photo: PhotoBackground | null;
  savedAt: number;
}

export const MAX_GRADIENT_COLORS = 3;
export const GRADIENT_KEY = "hearth-gradient";
export const GRADIENTS_KEY = "hearth-gradients";
export const PHOTO_KEY = "hearth-photo";
/** The colours at the top and bottom of the photo as last shown, so Safari's bars match it from the first paint. */
export const PHOTO_EDGES_KEY = "hearth-photo-edges";

/** Starting points for the gradient studio: one colour each, deep on top and light below. */
export const GRADIENT_SAMPLES: { name: string; colors: [string, string] }[] = [
  { name: "Ocean", colors: ["#0f2a5c", "#7fb2f0"] },
  { name: "Forest", colors: ["#1d3b2a", "#a9c5a0"] },
  { name: "Sunset", colors: ["#9a3412", "#fdba74"] },
];

export const DEFAULT_GRADIENT: CustomGradient = {
  id: "default", name: GRADIENT_SAMPLES[0].name, colors: GRADIENT_SAMPLES[0].colors, style: "smooth", motion: 0.25, swirl: 0.15, distortion: 0.5, grain: false, dimAtNight: true,
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
export const GLASS_KEY = "hearth-glass";
/** How see-through resting tiles are, 0.1 to 1, when the person sets it; otherwise the tile style decides. */
export const TILE_OPACITY_KEY = "hearth-tile-opacity";
export const GLASS_LEVELS = ["frosted", "clear", "solid"] as const;
export type GlassLevel = (typeof GLASS_LEVELS)[number];

/** Runs before first paint so the page never flashes the wrong theme or backdrop. Keep it dependency free. */
export const THEME_BOOTSTRAP = `(()=>{try{var r=document.documentElement,s=localStorage,p=s.getItem("${THEME_KEY}")||"system",d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light";var a=s.getItem("${ACCENT_KEY}");if(a)r.dataset.accent=a;var gl=s.getItem("${GLASS_KEY}");if(gl)r.dataset.glass=gl;var to=+s.getItem("${TILE_OPACITY_KEY}");if(to>0&&to<=1)r.style.setProperty("--tile-opacity",String(to));var w=/^\\/(sign-in|sign-up|setup)?(\\/|$)/.test(location.pathname)?null:s.getItem("${WALLPAPER_KEY}");if(w)r.dataset.wallpaper=w;if(w==="gradient"){var g=JSON.parse(s.getItem("${GRADIENT_KEY}")||"null");var c=g&&(d&&g.dimAtNight&&g.night||g.colors);if(c&&c.length){for(var i=0;i<4;i++)r.style.setProperty("--m"+(i+1),c[i%c.length]);var t=g.style||"flowing",L=function(h){var n=parseInt(h.slice(1),16);return [n>>16,n>>8&255,n&255].map(function(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4)}).reduce(function(x,v,j){return x+v*[.2126,.7152,.0722][j]},0)},v=t==="smooth"?L(c[0])*.8+L(c[c.length-1])*.2:c.reduce(function(x,h){return x+L(h)},0)/c.length;r.dataset.gradientStyle=t;r.style.setProperty("--gradient","linear-gradient(180deg,"+c.join(",")+")");r.style.setProperty("--g-last",c[c.length-1]);if(v<.2)r.dataset.backdrop="dark"}}if(w==="photo"){var f=JSON.parse(s.getItem("${PHOTO_KEY}")||"null");if(f&&/^[\\w-]+$/.test(f.id)){r.style.setProperty("--photo","url(/api/backgrounds/"+f.id+")");r.style.setProperty("--photo-blur",(+f.blur||0)+"px");r.style.setProperty("--photo-dim",String(+f.dim||0));var e=JSON.parse(s.getItem("${PHOTO_EDGES_KEY}")||"null");if(e&&e.id===f.id&&e.dim===(+f.dim||0)&&e.theme===(d?"dark":"light")){r.style.setProperty("--edge-top",e.top);r.style.setProperty("--edge-bottom",e.bottom);r.style.setProperty("--page-floor",e.bottom)}}}}catch(e){}})()`;
