"use client";

import { Dices, Plus, Wand2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, type CSSProperties } from "react";
import useSWR from "swr";
import { Button } from "@/components/arc/button/button";
import { ColorPicker } from "@/components/arc/color-picker/color-picker";
import { Drawer, DrawerContent } from "@/components/arc/drawer/drawer";
import { FileUpload } from "@/components/arc/file-upload/file-upload";
import { Input } from "@/components/arc/input/input";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Slider } from "@/components/arc/slider/slider";
import { Switch } from "@/components/arc/switch/switch";
import { glassClass, glassSheetClass } from "@/components/glass/glass";
import { gradientColors } from "@/components/glass/wallpaper";
import { fetchPhotos, type PhotoSummary } from "@/components/shell/background-picker";
import { applyGradientVars, applyPhotoVars, withNight } from "@/components/shell/background-vars";
import { paletteFromImage, resizeImage, uploadPhoto } from "@/components/shell/image-tools";
import { closeStudio, openStudio, useStudio, type StudioTab } from "@/components/shell/studio-store";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { usePrefersReducedMotion } from "@/components/shell/use-reduced-motion-preference";
import { useResolvedTheme } from "@/components/shell/use-resolved-theme";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { shufflePalette } from "@/lib/backgrounds/palette";
import {
  DEFAULT_GRADIENT, DEFAULT_WALLPAPER, GRADIENT_KEY, GRADIENT_PALETTES, GRADIENTS_KEY, MAX_GRADIENT_COLORS, PHOTO_KEY, WALLPAPER_KEY,
  type CustomGradient, type PhotoBackground, type Wallpaper,
} from "@/lib/theme";
import styles from "./background-studio.module.css";

const MeshBackdrop = dynamic(() => import("@/components/glass/mesh-backdrop"), { ssr: false });
const NO_GRADIENTS: CustomGradient[] = [];
const MAX_UPLOAD = 20 * 1024 * 1024;

/**
 * Make a background of your own. Every change shows at once on the real dashboard behind the drawer and in the
 * preview, which puts sample glass tiles over it so legibility is judged before anything is kept.
 */
export function BackgroundStudio() {
  const tab = useStudio();
  return (
    <Drawer open={tab !== null} onOpenChange={open => !open && closeStudio()}>
      <DrawerContent side="right" className={`${glassSheetClass} ${styles.drawer}`} title="Background studio" description="Changes show straight away and are saved on this device.">
        {tab && <Studio tab={tab} />}
      </DrawerContent>
    </Drawer>
  );
}

function Studio({ tab }: { tab: StudioTab }) {
  return (
    <div className={styles.studio}>
      <SegmentedControl label="Kind" value={tab} onValueChange={value => openStudio(value as StudioTab)} options={[{ value: "gradient", label: "Gradient" }, { value: "photo", label: "Photo" }]} />
      {tab === "gradient" ? <GradientEditor /> : <PhotoEditor />}
    </div>
  );
}

function Preview({ children, style }: { children?: React.ReactNode; style?: CSSProperties }) {
  return (
    <figure className={styles.preview} style={style} aria-label="Preview">
      {children}
      <div className={styles.previewTiles} aria-hidden="true">
        <span className={`${glassClass("panel")} ${styles.previewTile}`}><b>21°</b><small>Living room</small></span>
        <span className={`${glassClass("panel")} ${styles.previewTile}`} data-on><b>80%</b><small>Pendants</small></span>
        <span className={`${glassClass("panel")} ${styles.previewWide}`}><b>Front door</b><small>Locked</small></span>
      </div>
    </figure>
  );
}

function GradientEditor() {
  const theme = useResolvedTheme();
  const still = usePrefersReducedMotion();
  const [, setWallpaper] = useHtmlPreference<Wallpaper>(WALLPAPER_KEY, "wallpaper", DEFAULT_WALLPAPER);
  const [gradient, setGradient] = useStoredJson<CustomGradient>(GRADIENT_KEY, DEFAULT_GRADIENT);
  const [gradients, setGradients] = useStoredJson<CustomGradient[]>(GRADIENTS_KEY, NO_GRADIENTS);
  const saved = gradients.find(item => item.id === gradient.id);
  const changed = !saved || JSON.stringify(withNight(saved)) !== JSON.stringify(withNight(gradient));

  const update = (patch: Partial<CustomGradient>) => {
    const next = withNight({ ...gradient, ...patch });
    setGradient(next);
    applyGradientVars(next, theme);
    setWallpaper("gradient");
  };
  const setColor = (index: number, hex: string) => update({ colors: gradient.colors.map((color, position) => position === index ? hex.slice(0, 7) : color) });
  const save = () => {
    const next = withNight(gradient.id === DEFAULT_GRADIENT.id ? { ...gradient, id: crypto.randomUUID() } : gradient);
    setGradient(next);
    setGradients(saved ? gradients.map(item => item.id === next.id ? next : item) : [...gradients, next].slice(-12));
  };
  const startNew = () => update({ ...DEFAULT_GRADIENT, id: crypto.randomUUID(), name: `Gradient ${gradients.length + 1}`, colors: shufflePalette() });

  return (
    <div className={styles.editor}>
      <Preview>
        <MeshBackdrop className={styles.previewMesh} colors={gradientColors(gradient, theme)} still={still || gradient.motion === 0} motion={gradient.motion} swirl={gradient.swirl} distortion={gradient.distortion} grain={gradient.grain} />
      </Preview>

      <div className={styles.row}>
        <Input label="Name" value={gradient.name} maxLength={30} onChange={event => update({ name: event.target.value })} />
        <Button variant="ghost" onClick={startNew}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> New</Button>
      </div>

      <section className={styles.section} aria-labelledby="studio-colours">
        <div className={styles.sectionHead}>
          <h3 id="studio-colours" className={styles.heading}>Colours</h3>
          <Button variant="ghost" size="sm" onClick={() => update({ colors: shufflePalette() })}><Dices size={15} strokeWidth={1.75} aria-hidden="true" /> Shuffle</Button>
        </div>
        <div className={styles.colors}>
          {gradient.colors.map((color, index) => (
            <div key={index} className={styles.color}>
              <ColorPicker label={`Colour ${index + 1}`} value={color} onValueChange={hex => setColor(index, hex)} defaultFormat="hex" />
              {gradient.colors.length > 2 && (
                <button type="button" className={styles.removeColor} aria-label={`Remove colour ${index + 1}`} onClick={() => update({ colors: gradient.colors.filter((_, position) => position !== index) })}>
                  <X size={12} strokeWidth={2.25} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          {gradient.colors.length < MAX_GRADIENT_COLORS && (
            <button type="button" className={styles.addColor} onClick={() => update({ colors: [...gradient.colors, shufflePalette()[1]] })}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add colour
            </button>
          )}
        </div>
        <div className={styles.palettes} role="list" aria-label="Starting palettes">
          {GRADIENT_PALETTES.map(palette => (
            <button key={palette.name} type="button" role="listitem" className={styles.palette} onClick={() => update({ colors: palette.colors })} title={palette.name}>
              <span className={styles.paletteSwatch} style={{ background: `linear-gradient(120deg, ${palette.colors.join(", ")})` }} aria-hidden="true" />
              <span>{palette.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="studio-feel">
        <h3 id="studio-feel" className={styles.heading}>Feel</h3>
        <Slider label="Motion" value={Math.round(gradient.motion * 100)} min={0} max={100} format={value => value === 0 ? "Still" : value < 34 ? "Slow" : value < 67 ? "Drifting" : "Lively"} onValueChange={value => update({ motion: value / 100 })} />
        <Slider label="Swirl" value={Math.round(gradient.swirl * 100)} min={0} max={100} format={value => `${value}%`} onValueChange={value => update({ swirl: value / 100 })} />
        <Slider label="Waves" value={Math.round(gradient.distortion * 100)} min={0} max={100} format={value => `${value}%`} onValueChange={value => update({ distortion: value / 100 })} />
        <div className={styles.switches}>
          <Switch label="Film grain" checked={gradient.grain} onCheckedChange={grain => update({ grain })} />
          <Switch label="Darker at night" checked={gradient.dimAtNight} onCheckedChange={dimAtNight => update({ dimAtNight })} />
        </div>
      </section>

      <div className={styles.footer}>
        <span className={styles.note}>{saved ? (changed ? "Unsaved changes" : "Saved to your gradients") : "Not in your gradients yet"}</span>
        <Button onClick={save} disabled={!changed}>{saved ? "Save changes" : "Save gradient"}</Button>
      </div>
    </div>
  );
}

function PhotoEditor() {
  const theme = useResolvedTheme();
  const [, setWallpaper] = useHtmlPreference<Wallpaper>(WALLPAPER_KEY, "wallpaper", DEFAULT_WALLPAPER);
  const [photo, setPhoto] = useStoredJson<PhotoBackground | null>(PHOTO_KEY, null);
  const [gradient, setGradient] = useStoredJson<CustomGradient>(GRADIENT_KEY, DEFAULT_GRADIENT);
  const { data: photos, mutate } = useSWR<PhotoSummary[]>("/api/backgrounds", fetchPhotos);
  const [extracting, setExtracting] = useState(false);

  const choose = (next: PhotoBackground) => {
    setPhoto(next);
    applyPhotoVars(next);
    setWallpaper("photo");
  };
  const toGradient = async () => {
    if (!photo) return;
    setExtracting(true);
    const colors = await paletteFromImage(`/api/backgrounds/${photo.id}`).catch(() => []);
    setExtracting(false);
    if (colors.length < 2) return;
    const next = withNight({ ...gradient, id: crypto.randomUUID(), name: "From my photo", colors: colors.slice(0, 4) });
    setGradient(next);
    applyGradientVars(next, theme);
    setWallpaper("gradient");
    openStudio("gradient");
  };

  return (
    <div className={styles.editor}>
      <Preview style={photo ? { "--photo-preview": `url(/api/backgrounds/${photo.id})`, "--photo-blur": `${photo.blur / 3}px`, "--photo-dim": String(photo.dim) } as CSSProperties : undefined}>
        {photo ? <span className={styles.previewPhoto} /> : <span className={styles.previewEmpty}>Upload a photo to see it here</span>}
      </Preview>

      <FileUpload
        label="Upload a photo"
        description="Resized on this device before it is sent. Up to 20 MB."
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        maxSize={MAX_UPLOAD}
        onUpload={async (file, { onProgress, signal }) => {
          const image = await resizeImage(file);
          const { id } = await uploadPhoto(image, onProgress, signal);
          await mutate();
          choose({ id, blur: photo?.blur ?? 0, dim: photo?.dim ?? 0.15 });
        }}
      />

      {photos && photos.length > 0 && (
        <section className={styles.section} aria-labelledby="studio-photos">
          <h3 id="studio-photos" className={styles.heading}>Your photos</h3>
          <div className={styles.photos} role="radiogroup" aria-labelledby="studio-photos">
            {photos.map((item, index) => (
              <button key={item.id} type="button" role="radio" aria-checked={photo?.id === item.id} aria-label={`Photo ${photos.length - index}`} className={styles.photoOption}
                style={{ backgroundImage: `url(/api/backgrounds/${item.id})` }} onClick={() => choose({ id: item.id, blur: photo?.blur ?? 0, dim: photo?.dim ?? 0.15 })} />
            ))}
          </div>
        </section>
      )}

      {photo && (
        <section className={styles.section} aria-labelledby="studio-photo-feel">
          <h3 id="studio-photo-feel" className={styles.heading}>Make it calmer</h3>
          <Slider label="Blur" value={photo.blur} min={0} max={24} format={value => value === 0 ? "Sharp" : `${value} px`} onValueChange={blur => choose({ ...photo, blur })} />
          <Slider label={theme === "dark" ? "Darken" : "Lighten"} value={Math.round(photo.dim * 100)} min={0} max={70} format={value => `${value}%`} onValueChange={value => choose({ ...photo, dim: value / 100 })} />
          <Button variant="secondary" loading={extracting} onClick={toGradient}><Wand2 size={16} strokeWidth={1.75} aria-hidden="true" /> Make a moving gradient from this photo</Button>
        </section>
      )}
    </div>
  );
}
