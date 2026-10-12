"use client";

import { useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { glassSheetClass } from "@/components/glass/glass";
import { ADDABLE_KINDS, KIND_INFO } from "@/lib/dashboard/catalog";
import { isWidget, type TileConfig, type TileKind, type WeatherPlace } from "@/lib/dashboard/layout";
import { EntityChooser, type Candidate } from "./entity-chooser";
import { PlaceSearch } from "./place-search";
import { TILE_ICON_COMPONENTS } from "./tiles/tile-icons";
import styles from "./tile-dialog.module.css";

export type TileDialogMode = { mode: "add" } | { mode: "link"; tile: TileConfig } | { mode: "place"; tile: TileConfig };

interface TileDialogProps {
  state: TileDialogMode | null;
  onOpenChange: (open: boolean) => void;
  candidates: (kind: TileKind) => Candidate[];
  /** A new tile, linked or not, with options such as a weather place. */
  onAdd: (kind: TileKind, link: string | null, options?: TileConfig["options"]) => void;
  onLink: (tileId: string, link: string) => void;
  onPlace: (tileId: string, place: WeatherPlace, units: "C" | "F") => void;
}

const defaultUnits = (): "C" | "F" => typeof navigator !== "undefined" && /^en-(US|LR|MM)/.test(navigator.language) ? "F" : "C";

/** Add a tile from the gallery, then link it to a device, pick a city, or add it as is. Also relinks a tile. */
export function TileDialog({ state, onOpenChange, candidates, onAdd, onLink, onPlace }: TileDialogProps) {
  const [shown, setShown] = useState(state);
  const [kind, setKind] = useState<TileKind | null>(null);
  if (shown !== state) {
    setShown(state);
    setKind(state && state.mode !== "add" ? state.tile.kind : null);
  }
  const [title, description] = heading(state, kind);
  return (
    <Dialog open={Boolean(state)} onOpenChange={onOpenChange}>
      <DialogContent className={`${glassSheetClass} ${styles.dialog}`} title={title} description={description}>
        {state && <Body key={state.mode === "add" ? "add" : state.tile.id} state={state} kind={kind} setKind={setKind} candidates={candidates} onAdd={onAdd} onLink={onLink} onPlace={onPlace} close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function heading(state: TileDialogMode | null, kind: TileKind | null): [string, string] {
  if (!state) return ["", ""];
  if (state.mode === "place" || (state.mode === "add" && kind === "weather")) return ["Choose a place", "The weather tile forecasts for this city."];
  if (state.mode === "link") return [`Link ${state.tile.label ?? KIND_INFO[state.tile.kind].label}`, "Choose what this tile shows."];
  if (kind) return [`Choose the ${KIND_INFO[kind].label.toLowerCase()}`, "Pick what this tile shows, or add it now and link it later."];
  return ["Add a tile", "Pick what the tile is. You can link it to a device now or later."];
}

interface BodyProps extends Omit<TileDialogProps, "state" | "onOpenChange"> {
  state: TileDialogMode;
  kind: TileKind | null;
  setKind: (kind: TileKind | null) => void;
  close: () => void;
}

function Body({ state, kind, setKind, candidates, onAdd, onLink, onPlace, close }: BodyProps) {
  const [units, setUnits] = useState<"C" | "F">(state.mode === "place" ? state.tile.options?.units ?? defaultUnits() : defaultUnits());

  if (state.mode === "add" && !kind) {
    return (
      <div className={styles.gallery}>
        {ADDABLE_KINDS.map(option => {
          const info = KIND_INFO[option];
          const Icon = TILE_ICON_COMPONENTS[info.icon];
          const count = isWidget(option) ? null : candidates(option).length;
          return (
            <button key={option} type="button" className={styles.kind} onClick={() => {
              if (option === "calendar" || option === "reminders" || option === "clock") {
                onAdd(option, null);
                close();
              } else {
                setKind(option);
              }
            }}>
              <span className={styles.kindIcon} data-color={info.color} aria-hidden="true"><Icon size={20} strokeWidth={1.75} /></span>
              <span className={styles.kindName}>{info.label}</span>
              <span className={styles.kindNote}>{count === null ? info.description : count === 0 ? "None connected yet" : `${count} available`}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const chosen = kind as TileKind;
  if (chosen === "weather") {
    return (
      <div className={styles.step}>
        <SegmentedControl label="Units" value={units} onValueChange={value => setUnits(value as "C" | "F")} options={[{ value: "C", label: "Celsius" }, { value: "F", label: "Fahrenheit" }]} />
        <PlaceSearch onChoose={place => {
          if (state.mode === "place") onPlace(state.tile.id, place, units);
          else onAdd("weather", null, { place, units });
          close();
        }} />
        {state.mode === "add" && <div className={styles.actions}><Button variant="ghost" onClick={() => setKind(null)}>Back</Button></div>}
      </div>
    );
  }

  const current = state.mode === "link" ? state.tile.link : null;
  return (
    <div className={styles.step}>
      <EntityChooser
        candidates={candidates(chosen)}
        current={current}
        empty={`Nothing to link yet. Connect Home Assistant or a Matter server in Settings, then come back${state.mode === "add" ? ", or add the tile now and link it later" : ""}.`}
        onChoose={id => {
          if (state.mode === "link") onLink(state.tile.id, id);
          else onAdd(chosen, id);
          close();
        }}
      />
      <div className={styles.actions}>
        {state.mode === "add" && <Button variant="ghost" onClick={() => setKind(null)}>Back</Button>}
        {state.mode === "add" && <Button variant="secondary" onClick={() => { onAdd(chosen, null); close(); }}>Add without linking</Button>}
      </div>
    </div>
  );
}
