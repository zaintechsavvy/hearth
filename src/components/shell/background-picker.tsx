"use client";

import { ImagePlus, Pencil, Sparkles, X } from "lucide-react";
import type { CSSProperties } from "react";
import useSWR from "swr";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { applyGradientVars, applyPhotoVars, shownColors, styleOf, withNight } from "@/components/shell/background-vars";
import { openStudio } from "@/components/shell/studio-store";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { useResolvedTheme } from "@/components/shell/use-resolved-theme";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { useThemePreference } from "@/components/shell/use-theme-preference";
import {
  DEFAULT_GRADIENT, DEFAULT_WALLPAPER, GRADIENT_KEY, GRADIENT_SAMPLES, GRADIENTS_KEY, isMesh, MESH_PALETTES, PHOTO_KEY, PRESET_WALLPAPERS, WALLPAPER_KEY, WALLPAPER_LABELS,
  type CustomGradient, type PhotoBackground, type ThemePreference, type Wallpaper,
} from "@/lib/theme";
import styles from "./background-picker.module.css";

export interface PhotoSummary {
  id: string;
  width: number;
  height: number;
}

const NO_GRADIENTS: CustomGradient[] = [];
const DEFAULT_PHOTO = { blur: 0, dim: 0.15 };

export function meshPreview(colors: string[]): CSSProperties {
  const [base, first, second, third] = [...colors, ...colors, ...colors];
  return {
    background: `radial-gradient(70% 70% at 15% 20%, ${first}, transparent 70%), radial-gradient(60% 60% at 85% 25%, ${third}, transparent 70%), radial-gradient(70% 70% at 70% 90%, ${second}, transparent 70%), ${base}`,
  };
}

/** How a gradient looks as a small swatch: a plain blend for smooth ones, a soft mesh for flowing ones. */
export function gradientSwatch(gradient: CustomGradient, theme: "light" | "dark"): CSSProperties {
  const colors = shownColors(gradient, theme);
  return styleOf(gradient) === "smooth" ? { background: `linear-gradient(180deg, ${colors.join(", ")})` } : meshPreview(colors);
}

/** The studio's samples as ready gradients. Their ids are fixed, so picking one never piles up unsaved copies. */
const SAMPLE_GRADIENTS: CustomGradient[] = GRADIENT_SAMPLES.map(sample => withNight({ ...DEFAULT_GRADIENT, id: `sample-${sample.name.toLowerCase()}`, name: sample.name, colors: sample.colors }));

export const fetchPhotos = (url: string): Promise<PhotoSummary[]> => fetch(url).then(response => response.ok ? response.json() : []);

/** Light, dark, or system, then a preset, one of your gradients, or one of your photos. */
export function BackgroundPicker({ showTheme = true }: { showTheme?: boolean }) {
  const [theme, setTheme] = useThemePreference();
  const resolved = useResolvedTheme();
  const [wallpaper, setWallpaper] = useHtmlPreference<Wallpaper>(WALLPAPER_KEY, "wallpaper", DEFAULT_WALLPAPER);
  const [gradient, setGradient] = useStoredJson<CustomGradient>(GRADIENT_KEY, DEFAULT_GRADIENT);
  const [gradients, setGradients] = useStoredJson<CustomGradient[]>(GRADIENTS_KEY, NO_GRADIENTS);
  const [photo, setPhoto] = useStoredJson<PhotoBackground | null>(PHOTO_KEY, null);
  const { data: photos, mutate } = useSWR<PhotoSummary[]>("/api/backgrounds", fetchPhotos);

  const chooseGradient = (next: CustomGradient) => {
    setGradient(next);
    applyGradientVars(next, resolved);
    setWallpaper("gradient");
  };
  const choosePhoto = (id: string) => {
    const next = { ...DEFAULT_PHOTO, ...(photo?.id === id ? photo : { blur: photo?.blur ?? DEFAULT_PHOTO.blur, dim: photo?.dim ?? DEFAULT_PHOTO.dim }), id };
    setPhoto(next);
    applyPhotoVars(next);
    setWallpaper("photo");
  };
  const removePhoto = async (id: string) => {
    await fetch(`/api/backgrounds/${id}`, { method: "DELETE" });
    if (wallpaper === "photo" && photo?.id === id) setWallpaper(DEFAULT_WALLPAPER);
    await mutate();
  };
  const unsaved = wallpaper === "gradient" && !gradients.some(item => item.id === gradient.id) && !SAMPLE_GRADIENTS.some(item => item.id === gradient.id);

  return (
    <div className={styles.picker}>
      {showTheme && (
        <SegmentedControl label="Theme" value={theme} onValueChange={value => setTheme(value as ThemePreference)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
      )}
      <section className={styles.group} aria-labelledby="backgrounds-presets">
        <h3 id="backgrounds-presets" className={styles.heading}>Presets</h3>
        <div role="radiogroup" aria-labelledby="backgrounds-presets" className={styles.options}>
          {PRESET_WALLPAPERS.filter(option => resolved === "dark" || !isMesh(option)).map(option => (
            <button key={option} type="button" role="radio" aria-checked={wallpaper === option} className={styles.option} onClick={() => setWallpaper(option)}>
              <span className={styles.swatch} data-preview={option} style={isMesh(option) ? meshPreview(MESH_PALETTES[option]) : undefined} aria-hidden="true" />
              <span className={styles.label}>{WALLPAPER_LABELS[option].name}</span>
              <span className={styles.note}>{WALLPAPER_LABELS[option].note}</span>
            </button>
          ))}
        </div>
        {resolved === "light" && <p className={styles.note}>The drifting backgrounds appear in dark mode.</p>}
      </section>
      <section className={styles.group} aria-labelledby="backgrounds-gradients">
        <h3 id="backgrounds-gradients" className={styles.heading}>Gradients</h3>
        <div role="radiogroup" aria-labelledby="backgrounds-gradients" className={styles.options}>
          {SAMPLE_GRADIENTS.map(item => (
            <button key={item.id} type="button" role="radio" aria-checked={wallpaper === "gradient" && gradient.id === item.id} className={styles.option} onClick={() => chooseGradient(item)}>
              <span className={styles.swatch} style={gradientSwatch(item, resolved)} aria-hidden="true" />
              <span className={styles.label}>{item.name}</span>
              <span className={styles.note}>Two-tone</span>
            </button>
          ))}
        </div>
      </section>
      <section className={styles.group} aria-labelledby="backgrounds-yours">
        <h3 id="backgrounds-yours" className={styles.heading}>Yours</h3>
        <div role="radiogroup" aria-labelledby="backgrounds-yours" className={styles.options}>
          {unsaved && (
            <div className={styles.item}>
              <button type="button" role="radio" aria-checked className={styles.option} onClick={() => openStudio("gradient")}>
                <span className={styles.swatch} style={gradientSwatch(gradient, resolved)} aria-hidden="true" />
                <span className={styles.label}>{gradient.name}</span>
                <span className={styles.note}>Not saved yet</span>
              </button>
            </div>
          )}
          {gradients.map(item => (
            <div key={item.id} className={styles.item}>
              <button type="button" role="radio" aria-checked={wallpaper === "gradient" && gradient.id === item.id} className={styles.option} onClick={() => chooseGradient(item)}>
                <span className={styles.swatch} style={gradientSwatch(item, resolved)} aria-hidden="true" />
                <span className={styles.label}>{item.name}</span>
                <span className={styles.note}>Gradient</span>
              </button>
              <span className={styles.itemTools}>
                <button type="button" className={styles.itemTool} aria-label={`Edit ${item.name}`} onClick={() => { chooseGradient(item); openStudio("gradient"); }}><Pencil size={13} strokeWidth={2} aria-hidden="true" /></button>
                <button type="button" className={styles.itemTool} aria-label={`Remove ${item.name}`} onClick={() => {
                  setGradients(gradients.filter(entry => entry.id !== item.id));
                  if (wallpaper === "gradient" && gradient.id === item.id) setWallpaper(DEFAULT_WALLPAPER);
                }}><X size={13} strokeWidth={2} aria-hidden="true" /></button>
              </span>
            </div>
          ))}
          {photos?.map((item, index) => (
            <div key={item.id} className={styles.item}>
              <button type="button" role="radio" aria-checked={wallpaper === "photo" && photo?.id === item.id} className={styles.option} onClick={() => choosePhoto(item.id)}>
                <span className={styles.swatch} style={{ background: `url(/api/backgrounds/${item.id}) center / cover` }} aria-hidden="true" />
                <span className={styles.label}>Photo {photos.length - index}</span>
                <span className={styles.note}>{item.width} × {item.height}</span>
              </button>
              <span className={styles.itemTools}>
                <button type="button" className={styles.itemTool} aria-label={`Adjust photo ${photos.length - index}`} onClick={() => { choosePhoto(item.id); openStudio("photo"); }}><Pencil size={13} strokeWidth={2} aria-hidden="true" /></button>
                <button type="button" className={styles.itemTool} aria-label={`Remove photo ${photos.length - index}`} onClick={() => void removePhoto(item.id)}><X size={13} strokeWidth={2} aria-hidden="true" /></button>
              </span>
            </div>
          ))}
          <button type="button" className={`${styles.option} ${styles.add}`} onClick={() => openStudio("gradient")}>
            <span className={`${styles.swatch} ${styles.addSwatch}`} aria-hidden="true"><Sparkles size={18} strokeWidth={1.75} /></span>
            <span className={styles.label}>New gradient</span>
            <span className={styles.note}>Pick the colours</span>
          </button>
          <button type="button" className={`${styles.option} ${styles.add}`} onClick={() => openStudio("photo")}>
            <span className={`${styles.swatch} ${styles.addSwatch}`} aria-hidden="true"><ImagePlus size={18} strokeWidth={1.75} /></span>
            <span className={styles.label}>Upload a photo</span>
            <span className={styles.note}>JPEG, PNG, or WebP</span>
          </button>
        </div>
      </section>
    </div>
  );
}
