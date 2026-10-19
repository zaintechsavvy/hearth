"use client";

import { Check, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { SearchField } from "@/components/arc/search-field/search-field";
import { glassSheetClass } from "@/components/glass/glass";
import { chooseSampleTransit, saveTransitKey } from "@/lib/actions";
import type { TransitStop } from "@/lib/dashboard/layout";
import type { StopChoice } from "@/lib/transit-types";
import styles from "./stops-dialog.module.css";

const MAX_STOPS = 4;
const KEY_URL = "https://www.transit.land/documentation#signing-up-for-an-api-key";

const fetchStops = async (url: string) => {
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Stops did not load.");
  return body as { stops: StopChoice[]; near: boolean };
};

/** Picks the stops a departures tile lists, after a one-time free Transitland key. */
export function StopsDialog({ open, ready, sample, initial, onOpenChange, onSave }: { open: boolean; ready: boolean; sample: boolean; initial: TransitStop[]; onOpenChange: (open: boolean) => void; onSave: (stops: TransitStop[]) => void }) {
  const [addingKey, setAddingKey] = useState(false);
  const picking = ready && !addingKey;
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) setAddingKey(false); onOpenChange(next); }}>
      <DialogContent className={glassSheetClass} title={picking ? "Choose your stops" : "Connect Transitland"}
        description={picking ? sample ? "These are sample stops with made-up times, to see how the tile looks." : "Pick up to four stops. The tile lists what leaves next from all of them." : "Transitland gathers timetables and live times from transit agencies around the world. Its key is free."}>
        {open && (picking ? (
          <>
            {sample && <p className={styles.help}>Ready for real ones? <button type="button" className={styles.link} onClick={() => setAddingKey(true)}>Add a Transitland key</button></p>}
            <StopPicker initial={sample ? initial.filter(stop => stop.key.startsWith("sample:")) : initial.filter(stop => !stop.key.startsWith("sample:"))} onSave={stops => { onSave(stops); onOpenChange(false); }} />
          </>
        ) : <KeyForm onSaved={() => setAddingKey(false)} />)}
      </DialogContent>
    </Dialog>
  );
}

function KeyForm({ onSaved }: { onSaved: () => void }) {
  const { mutate } = useSWRConfig();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await saveTransitKey(String(new FormData(event.currentTarget).get("key") ?? ""));
    setPending(false);
    if (!result.ok) return setError(result.error);
    await mutate("/api/home");
    onSaved();
  }
  const trySample = async () => {
    setPending(true);
    const result = await chooseSampleTransit();
    setPending(false);
    if (!result.ok) return setError(result.error);
    await mutate("/api/home");
    onSaved();
  };
  return (
    <form className={styles.form} onSubmit={submit}>
      <PasswordField label="Transitland API key" name="key" required autoComplete="off" description="Sign up at transit.land, then copy the key from your account." />
      <p className={styles.help}>Get one at <a href={KEY_URL} target="_blank" rel="noreferrer" className={styles.link}>transit.land</a>. Hearth keeps it encrypted and only uses it for this tile.</p>
      <Alert tone="danger" title="Could not save the key" open={Boolean(error)}>{error ?? ""}</Alert>
      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={() => void trySample()} disabled={pending}>Try sample times</Button>
        <Button type="submit" loading={pending}>Continue</Button>
      </div>
    </form>
  );
}

function StopPicker({ initial, onSave }: { initial: TransitStop[]; onSave: (stops: TransitStop[]) => void }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<TransitStop[]>(initial);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const { data, error, isLoading } = useSWR(`/api/transit/stops?q=${encodeURIComponent(search)}`, fetchStops, { keepPreviousData: true });
  const picked = new Set(chosen.map(stop => stop.key));
  const toggle = (stop: StopChoice) => setChosen(current => picked.has(stop.key) ? current.filter(item => item.key !== stop.key) : current.length >= MAX_STOPS ? current : [...current, { key: stop.key, name: stop.name }]);
  return (
    <div className={styles.form}>
      <SearchField label="Find a stop" value={query} onValueChange={setQuery} placeholder="Stop name, station, or street" />
      {chosen.length > 0 && (
        <ul className={styles.chips} aria-label="Chosen stops">
          {chosen.map(stop => (
            <li key={stop.key} className={styles.chip}>
              <span>{stop.name}</span>
              <button type="button" onClick={() => setChosen(current => current.filter(item => item.key !== stop.key))} aria-label={`Remove ${stop.name}`}><X size={14} strokeWidth={1.75} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.results} aria-busy={isLoading || undefined}>
        {error ? <p className={styles.help}>{error.message}</p>
          : !data ? <p className={styles.help}>Looking for stops</p>
            : data.stops.length === 0 ? <p className={styles.help}>{search ? "No stops match that." : data.near ? "No stops within a short walk. Search by name instead." : "Search by name, or set your home's location in Automations to see stops nearby."}</p> : (
              <>
                {!search && data.near && <p className={styles.heading}>Near home</p>}
                <ul className={styles.list}>
                  {data.stops.map(stop => {
                    const on = picked.has(stop.key);
                    return (
                      <li key={stop.key}>
                        <button type="button" className={styles.stop} aria-pressed={on} onClick={() => toggle(stop)} disabled={!on && chosen.length >= MAX_STOPS}>
                          <span className={styles.stopText}>
                            <span className={styles.stopName}>{stop.name}{stop.code ? <span className={styles.code}> · {stop.code}</span> : null}</span>
                            <span className={styles.stopMeta}>{[stop.distance !== null ? `${stop.distance < 1000 ? `${stop.distance} m` : `${(stop.distance / 1000).toFixed(1)} km`}` : null, stop.routes.length ? stop.routes.join(", ") : null].filter(Boolean).join(" · ")}</span>
                          </span>
                          {on ? <Check size={18} strokeWidth={1.75} aria-hidden="true" /> : <Plus size={18} strokeWidth={1.75} aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
      </div>
      <div className={styles.actions}>
        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
        <Button onClick={() => onSave(chosen)} disabled={chosen.length === 0}>Show {chosen.length === 1 ? "this stop" : "these stops"}</Button>
      </div>
    </div>
  );
}
