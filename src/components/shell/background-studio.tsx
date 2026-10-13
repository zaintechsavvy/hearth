"use client";

import { ArrowUpDown, Dices, Minus, Plus, Wand2 } from "lucide-react";
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
import { fetchPhotos, type PhotoSummary } from "@/components/shell/background-picker";
import { applyGradientVars, applyPhotoVars, shownColors, styleOf, withNight } from "@/components/shell/background-vars";
import { paletteFromImage, resizeImage, uploadPhoto } from "@/components/shell/image-tools";
import { closeStudio, openStudio, useStudio, type StudioTab } from "@/components/shell/studio-store";
import { useHtmlPreference } from "@/components/shell/use-html-preference";
import { usePrefersReducedMotion } from "@/components/shell/use-reduced-motion-preference";
import { useResolvedTheme } from "@/components/shell/use-resolved-theme";
import { useStoredJson } from "@/components/shell/use-stored-json";
import { backdropIsDark, mixHex, shufflePalette } from "@/lib/backgrounds/palette";
import {
  DEFAULT_GRADIENT, DEFAULT_WALLPAPER, GRADIENT_KEY, GRADIENT_SAMPLES, GRADIENTS_KEY, MAX_GRADIENT_COLORS, PHOTO_KEY, WALLPAPER_KEY,
  type CustomGradient, type GradientStyle, type PhotoBackground, type Wallpaper,
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

function Preview({ children, style, tone }: { children?: React.ReactNode; style?: CSSProperties; tone?: "light" | "dark" }) {
  return (
    <figure className={styles.preview} style={style} data-tone={tone} aria-label="Preview">
      {children}
      <div className={styles.previewGreeting} aria-hidden="true">
        <b>Good evening</b>
        <small>2 lights on · 21° inside</small>
      </div>
      <div className={styles.previewTiles} aria-hidden="true">
        <span className={`${glassClass("panel")} ${styles.previewTile}`}><b>21°</b><small>Living room</small></span>
        <span className={`${glassClass("panel")} ${styles.previewTile}`} data-on><b>80%</b><small>Pendants</small></span>
        <span className={`${glassClass("panel")} ${styles.previewTile}`}><b>Locked</b><small>Front door</small></span>
      </div>
    </figure>
  );
}

const STOP_NAMES = { 2: ["Top", "Bottom"], 3: ["Top", "Middle", "Bottom"] } as Record<number, string[]>;

function GradientEditor() {
  const theme = useResolvedTheme();
  const still = usePrefersReducedMotion();
  const [, setWallpaper] = useHtmlPreference<Wallpaper>(WALLPAPER_KEY, "wallpaper", DEFAULT_WALLPAPER);
  const [gradient, setGradient] = useStoredJson<CustomGradient>(GRADIENT_KEY, DEFAULT_GRADIENT);
  const [gradients, setGradients] = useStoredJson<CustomGradient[]>(GRADIENTS_KEY, NO_GRADIENTS);
  const saved = gradients.find(item => item.id === gradient.id);
  const changed = !saved || JSON.stringify(withNight(saved)) !== JSON.stringify(withNight(gradient));
  const style = styleOf(gradient);
  const colors = shownColors(gradient, theme);
  const { colors: stops } = gradient;
  const names = STOP_NAMES[stops.length] ?? stops.map((_, index) => `Colour ${index + 1}`);

  const update = (patch: Partial<CustomGradient>) => {
    const next = withNight({ ...gradient, ...patch });
    setGradient(next);
    applyGradientVars(next, theme);
    setWallpaper("gradient");
  };
  /** Samples and shuffles start a new gradient, so they never overwrite a saved one. */
  const start = (name: string, next: string[]) => update({ id: crypto.randomUUID(), name, colors: next });
  const setColor = (index: number, hex: string) => update({ colors: stops.map((color, position) => position === index ? hex.slice(0, 7) : color) });
  const save = () => {
    const next = withNight(gradient.id === DEFAULT_GRADIENT.id ? { ...gradient, id: crypto.randomUUID() } : gradient);
    setGradient(next);
    setGradients(saved ? gradients.map(item => item.id === next.id ? next : item) : [...gradients, next].slice(-12));
  };

  return (
    <div className={styles.editor}>
      <Preview tone={backdropIsDark(colors, style) ? "dark" : "light"}>
        {style === "flowing"
          ? <MeshBackdrop className={styles.previewMesh} colors={colors} still={still || gradient.motion === 0} motion={gradient.motion} swirl={gradient.swirl} distortion={gradient.distortion} />
          : <span className={styles.previewMesh} style={{ background: `linear-gradient(180deg, ${colors.join(", ")})` }} />}
      </Preview>

      <section className={styles.section} aria-labelledby="studio-samples">
        <div className={styles.sectionHead}>
          <h3 id="studio-samples" className={styles.heading}>Start from</h3>
          <Button variant="ghost" size="sm" onClick={() => start("Shuffled", shufflePalette())}><Dices size={16} strokeWidth={1.75} aria-hidden="true" /> Surprise me</Button>
        </div>
        <div className={styles.samples} role="radiogroup" aria-labelledby="studio-samples">
          {GRADIENT_SAMPLES.map(sample => (
            <button key={sample.name} type="button" role="radio" aria-checked={stops.join() === sample.colors.join()} className={styles.sample} onClick={() => start(sample.name, [...sample.colors])}>
              <span className={styles.sampleSwatch} style={{ background: `linear-gradient(180deg, ${sample.colors.join(", ")})` }} aria-hidden="true" />
              <span className={styles.sampleName}>{sample.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="studio-colours">
        <div className={styles.sectionHead}>
          <h3 id="studio-colours" className={styles.heading}>Colours</h3>
          <Button variant="ghost" size="sm" onClick={() => update({ colors: [...stops].reverse() })}><ArrowUpDown size={16} strokeWidth={1.75} aria-hidden="true" /> Swap</Button>
        </div>
        <div className={styles.stops}>
          {stops.map((color, index) => (
            <ColorPicker key={index} label={names[index]} value={color} onValueChange={hex => setColor(index, hex)} defaultFormat="hex" />
          ))}
        </div>
        {stops.length < MAX_GRADIENT_COLORS
          ? <Button variant="ghost" size="sm" className={styles.stopToggle} onClick={() => update({ colors: [stops[0], mixHex(stops[0], stops[stops.length - 1]), stops[stops.length - 1]] })}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add a middle colour</Button>
          : <Button variant="ghost" size="sm" className={styles.stopToggle} onClick={() => update({ colors: [stops[0], stops[stops.length - 1]] })}><Minus size={16} strokeWidth={1.75} aria-hidden="true" /> Just two colours</Button>}
      </section>

      <section className={styles.section} aria-labelledby="studio-style">
        <h3 id="studio-style" className={styles.heading}>Style</h3>
        <SegmentedControl label="Style" value={style} onValueChange={value => update({ style: value as GradientStyle })} options={[{ value: "smooth", label: "Smooth" }, { value: "flowing", label: "Flowing" }]} />
        {style === "flowing" && (
          <Slider label="Movement" value={Math.round(gradient.motion * 100)} min={0} max={100} format={value => value === 0 ? "Still" : value < 34 ? "Slow" : value < 67 ? "Drifting" : "Lively"} onValueChange={value => update({ motion: value / 100 })} />
        )}
        <Switch label="Darker at night" checked={gradient.dimAtNight} onCheckedChange={dimAtNight => update({ dimAtNight })} />
      </section>

      <div className={styles.footer}>
        <Input label="Name" className={styles.name} value={gradient.name} maxLength={30} onChange={event => update({ name: event.target.value })} />
        <Button onClick={save} disabled={!changed}>{!saved ? "Save" : changed ? "Save changes" : "Saved"}</Button>
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
    const next = withNight({ ...gradient, id: crypto.randomUUID(), name: "From my photo", colors: colors.slice(0, MAX_GRADIENT_COLORS), style: "flowing" });
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
