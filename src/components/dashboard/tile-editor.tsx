"use client";

import { Link2, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import useSWR from "swr";
import { Button } from "@/components/arc/button/button";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { Input } from "@/components/arc/input/input";
import { RadioCards } from "@/components/arc/radio-cards/radio-cards";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { motionTokens } from "@/components/arc/lib/motion-tokens";
import { glassSheetClass } from "@/components/glass/glass";
import { KIND_INFO } from "@/lib/dashboard/catalog";
import { isWidget, SIZE_OPTIONS, spanOf, TILE_COLORS, TILE_ICONS, type TileColor, type TileConfig, type TileIcon, type TileKind, type TileSize } from "@/lib/dashboard/layout";
import type { Agenda } from "@/lib/widgets/calendar";
import { RoomPicker } from "./room-picker";
import { TILE_ICON_COMPONENTS, iconLabel } from "./tiles/tile-icons";
import styles from "./tile-editor.module.css";

export interface TileIdentity {
  /** The device id, or `camera:<id>`, that renames and room moves apply to. */
  id: string;
  name: string;
  sourceName?: string;
  room: string | null;
  sourceRoom?: string | null;
  /** RTSP cameras and Hearth scenes have no room. */
  roomEditable: boolean;
  /** The integration's name for the source, such as "Home Assistant". */
  source: string;
}

export type IdentityChange = { name?: string | null; room?: string | null };

export interface EditableTile {
  config: TileConfig;
  kind: TileKind;
  name: string;
  /** What the tile shows: the device, camera, or scene, or the weather place. Null when nothing is linked. */
  linkedName: string | null;
  identity?: TileIdentity;
  adjustable: boolean;
  icon: TileIcon | null;
  color: TileColor | null;
}

interface TileEditorProps {
  tile: EditableTile | null;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<Omit<TileConfig, "id">>) => void;
  /** Renders the real tile for a config, without side effects such as opening a camera stream. */
  renderPreview: (config: TileConfig) => ReactNode;
  onRemove: () => void;
  rooms: string[];
  onIdentity: (change: IdentityChange) => void;
  /** Opens the chooser for what the tile shows: a device, or a place for weather. */
  onRelink: () => void;
  /** Extra actions for this kind of tile, such as editing a scene. */
  extra?: ReactNode;
}

interface Preview {
  size?: TileSize;
  icon?: TileIcon;
  color?: TileColor;
}

const SIZE_NOTES: Partial<Record<TileSize, string>> = {
  "1x1": "Tap to switch",
  "2x1": "Name and status",
  "1x2": "Vertical slider",
  "2x2": "Details and slider",
  "2x3": "A longer list",
  "2x4": "Full height",
  "3x3": "Room for every control",
  "4x2": "Panoramic",
  "4x3": "Big picture",
};

const MANAGE_LABELS: Partial<Record<TileKind, string>> = {
  bins: "Edit bins", medications: "Edit medications", countdown: "Edit countdown", notes: "Manage notes", wifi: "Edit network", timers: "New timer", plants: "Edit plants",
};

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

export function TileEditor({ tile, onOpenChange, onChange, onRemove, onRelink, rooms, onIdentity, renderPreview, extra }: TileEditorProps) {
  const [preview, setPreview] = useState<Preview>({});
  const styled = tile && tile.icon !== null;
  const options = tile ? SIZE_OPTIONS[tile.kind] : [];
  const blocked = (size: TileSize) => (size === "1x2" || size === "2x2") && SIZE_OPTIONS[tile?.kind ?? "light"].length > 2 && !tile?.adjustable;
  const shown: TileConfig | null = tile && {
    ...tile.config,
    size: preview.size ?? tile.config.size,
    icon: preview.icon ?? tile.icon ?? undefined,
    color: preview.color ?? tile.color ?? undefined,
  };
  const previewing = Boolean(preview.size || preview.icon || preview.color);
  const close = (open: boolean) => {
    if (!open) setPreview({});
    onOpenChange(open);
  };

  return (
    <Dialog open={Boolean(tile)} onOpenChange={close}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={tile ? `Customize ${tile.name}` : "Customize"} description="Point at an option to preview it, choose it to keep it.">
        {tile && shown && (
          <div className={styles.body}>
            <TilePreview config={shown} label={previewing ? "Previewing" : "Current"}>{renderPreview(shown)}</TilePreview>
            <div className={styles.options}>
            <LinkSection tile={tile} onChange={onChange} onRelink={onRelink} rooms={rooms} onIdentity={onIdentity} />
            <section aria-labelledby="tile-size" className={styles.section}>
              <h3 id="tile-size" className={styles.heading}>Template</h3>
              <div
                onPointerOver={event => {
                  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-card]");
                  const size = card ? options[Number(card.dataset.card)]?.size : undefined;
                  if (size && !blocked(size)) setPreview(current => ({ ...current, size }));
                }}
                onPointerLeave={() => setPreview(current => ({ ...current, size: undefined }))}
              >
                <RadioCards
                  aria-labelledby="tile-size"
                  minColumnWidth={112}
                  value={tile.config.size}
                  onValueChange={size => onChange({ size: size as TileSize })}
                  options={options.map(option => ({
                    value: option.size,
                    label: option.label,
                    meta: option.size.replace("x", "×"),
                    description: SIZE_NOTES[option.size],
                    disabled: blocked(option.size),
                    disabledReason: blocked(option.size) ? "Needs a dimmable light or a fan with speeds" : undefined,
                  }))}
                />
              </div>
            </section>
            {styled && (
              <>
                <section aria-labelledby="tile-icon" className={styles.section}>
                  <h3 id="tile-icon" className={styles.heading}>Icon</h3>
                  <div role="radiogroup" aria-labelledby="tile-icon" className={styles.icons}>
                    {TILE_ICONS.map(icon => {
                      const Icon = TILE_ICON_COMPONENTS[icon];
                      return (
                        <button key={icon} type="button" role="radio" aria-checked={tile.icon === icon} aria-label={iconLabel(icon)} title={iconLabel(icon)} className={styles.iconOption}
                          onClick={() => onChange({ icon })} onPointerEnter={() => setPreview(current => ({ ...current, icon }))} onPointerLeave={() => setPreview(current => ({ ...current, icon: undefined }))}>
                          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section aria-labelledby="tile-color" className={styles.section}>
                  <h3 id="tile-color" className={styles.heading}>Colour</h3>
                  <div role="radiogroup" aria-labelledby="tile-color" className={styles.colors}>
                    {TILE_COLORS.map(color => (
                      <button key={color} type="button" role="radio" aria-checked={tile.color === color} aria-label={capitalize(color)} title={capitalize(color)} className={styles.colorOption} data-color={color}
                        onClick={() => onChange({ color })} onPointerEnter={() => setPreview(current => ({ ...current, color }))} onPointerLeave={() => setPreview(current => ({ ...current, color: undefined }))} />
                    ))}
                  </div>
                </section>
              </>
            )}
            <div className={styles.actions}>
              <div className={styles.extra}>
                <Button variant="ghost" onClick={() => { onRemove(); close(false); }}>Remove tile</Button>
                {extra}
              </div>
              <DialogClose asChild><Button>Done</Button></DialogClose>
            </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinkSection({ tile, onChange, onRelink, rooms, onIdentity }: Pick<TileEditorProps, "onChange" | "onRelink" | "rooms" | "onIdentity"> & { tile: EditableTile }) {
  const { config } = tile;
  if (tile.kind === "weather") {
    return (
      <section aria-labelledby="tile-link" className={styles.section}>
        <h3 id="tile-link" className={styles.heading}>Place</h3>
        <div className={styles.link}>
          <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.linkName}>{tile.linkedName ?? "No place yet"}</span>
          <Button variant="secondary" size="sm" onClick={onRelink}>{tile.linkedName ? "Change" : "Choose"}</Button>
        </div>
        <SegmentedControl label="Units" value={config.options?.units ?? "C"} onValueChange={units => onChange({ options: { ...config.options, units: units as "C" | "F" } })} options={[{ value: "C", label: "Celsius" }, { value: "F", label: "Fahrenheit" }]} />
      </section>
    );
  }
  if (tile.kind === "calendar") return <CalendarChoice config={config} onChange={onChange} />;
  if (MANAGE_LABELS[tile.kind]) {
    return (
      <section aria-labelledby="tile-link" className={styles.section}>
        <h3 id="tile-link" className={styles.heading}>Shows</h3>
        <div className={styles.link}>
          <span className={styles.linkName}>{KIND_INFO[tile.kind].description}</span>
          <Button variant="secondary" size="sm" onClick={onRelink}>{MANAGE_LABELS[tile.kind]}</Button>
        </div>
      </section>
    );
  }
  if (isWidget(tile.kind)) return null;
  return (
    <section aria-labelledby="tile-link" className={styles.section}>
      <h3 id="tile-link" className={styles.heading}>Shows</h3>
      <div className={styles.link}>
        <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className={styles.linkName}>{tile.linkedName ?? "Not linked yet"}</span>
        <Button variant="secondary" size="sm" onClick={onRelink}>{tile.linkedName ? "Change" : "Link"}</Button>
      </div>
      {!tile.linkedName && (
        <Input label="Name" placeholder={KIND_INFO[tile.kind].label} defaultValue={config.label ?? ""} maxLength={60}
          onBlur={event => onChange({ label: event.target.value.trim() || undefined })} />
      )}
      {tile.identity && <IdentityFields key={tile.identity.id} identity={tile.identity} rooms={rooms} onIdentity={onIdentity} />}
    </section>
  );
}

/** Hearth's own name and room for the linked device; the integration keeps its own. */
function IdentityFields({ identity, rooms, onIdentity }: { identity: TileIdentity; rooms: string[]; onIdentity: TileEditorProps["onIdentity"] }) {
  const [name, setName] = useState(identity.name);
  const commit = () => {
    const next = name.trim();
    if (!next) return setName(identity.name);
    if (next !== identity.name) onIdentity({ name: next === identity.sourceName ? null : next });
  };
  return (
    <div className={styles.identity}>
      <div className={styles.nameField}>
        <Input label="Name" value={name} maxLength={60} onChange={event => setName(event.target.value)} onBlur={commit}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }}
          description={identity.sourceName ? undefined : `Changes it in Hearth only. ${identity.source} keeps its own name.`} />
        {identity.sourceName && (
          <p className={styles.note}>
            {identity.source} calls it {identity.sourceName}.
            <button type="button" className={styles.restore} onClick={() => { setName(identity.sourceName ?? identity.name); onIdentity({ name: null }); }}>Use that</button>
          </p>
        )}
      </div>
      {identity.roomEditable && (
        <RoomPicker rooms={rooms} value={identity.room} sourceRoom={identity.sourceRoom} sourceLabel={identity.source} onChange={room => onIdentity({ room })} />
      )}
    </div>
  );
}

function CalendarChoice({ config, onChange }: { config: TileConfig; onChange: TileEditorProps["onChange"] }) {
  const { data } = useSWR<Agenda>("/api/calendar", (url: string) => fetch(url).then(response => response.json()));
  const chosen = config.options?.calendars;
  const calendars = data?.calendars ?? [];
  const toggle = (id: string, on: boolean) => {
    const current = chosen ?? calendars.map(calendar => calendar.id);
    const next = on ? [...new Set([...current, id])] : current.filter(item => item !== id);
    onChange({ options: { ...config.options, calendars: next.length === calendars.length ? undefined : next } });
  };
  return (
    <section aria-labelledby="tile-calendars" className={styles.section}>
      <h3 id="tile-calendars" className={styles.heading}>Calendars</h3>
      {calendars.length === 0 ? (
        <p className={styles.note}>No calendars yet. <Link href="/settings#calendars">Add one in Settings</Link>.</p>
      ) : (
        <div className={styles.calendars}>
          {calendars.map(calendar => (
            <Checkbox key={calendar.id} label={calendar.name} checked={!chosen || chosen.includes(calendar.id)} onCheckedChange={on => toggle(calendar.id, on === true)} />
          ))}
        </div>
      )}
    </section>
  );
}

const CELL = 112;
const GAP = 12;
const STAGE_HEIGHT = 260;
const STAGE_WIDTH = 252;

/** The real tile at true grid proportions, scaled to fit the stage so text and controls look exactly as they will. */
function TilePreview({ config, label, children }: { config: TileConfig; label: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  const { columns, rows } = spanOf(config.size);
  const width = columns * CELL + (columns - 1) * GAP;
  const height = rows * CELL + (rows - 1) * GAP;
  const scale = Math.min(1, STAGE_WIDTH / width, STAGE_HEIGHT / height);
  return (
    <figure className={styles.stage} style={{ minHeight: STAGE_HEIGHT + 56 }} aria-label={`${label} tile, ${config.size.replace("x", " by ")}`}>
      <motion.div className={styles.frame} animate={{ width: width * scale, height: height * scale }} initial={false} transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}>
        <div className={styles.scaled} style={{ width, height, transform: `scale(${scale})` }} inert>{children}</div>
      </motion.div>
      <figcaption className={styles.stageLabel}>{label} · {config.size.replace("x", "×")}</figcaption>
    </figure>
  );
}
