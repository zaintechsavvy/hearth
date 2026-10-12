"use client";

import { CalendarDays, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/arc/alert/alert";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Dialog, DialogClose, DialogContent } from "@/components/arc/dialog/dialog";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/arc/input/input";
import { PasswordField } from "@/components/arc/password-field/password-field";
import { Glass, glassSheetClass } from "@/components/glass/glass";
import { addCalendar, removeCalendar } from "@/lib/actions";
import { TILE_COLORS, type TileColor } from "@/lib/dashboard/layout";
import styles from "./connections.module.css";

export interface CalendarRow {
  id: string;
  name: string;
  color: TileColor;
  host: string;
}

const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

export function CalendarsSection({ calendars }: { calendars: CalendarRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<TileColor>("rose");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await addCalendar({ name: String(form.get("name")), url: String(form.get("url")), color });
    setPending(false);
    if (!result.ok) return setError(result.error);
    setAdding(false);
    router.refresh();
  }

  return (
    <section id="calendars" className={styles.section} aria-labelledby="calendars-title">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="calendars-title" className={styles.sectionTitle}>Calendars</h2>
          <p className={styles.sectionDescription}>Google Calendar, iCloud, Outlook, or any iCal address, read only. Show them with a Calendar tile.</p>
        </div>
        <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={16} strokeWidth={1.75} aria-hidden="true" /> Add</Button>
      </div>

      <Glass shape="panel" className={styles.group}>
        {calendars.length === 0 ? (
          <div className={styles.row}>
            <EmptyState className={styles.empty} icon={<CalendarDays size={24} strokeWidth={1.75} />} title="No calendars yet" description="Add your Google Calendar with its secret iCal address." />
          </div>
        ) : calendars.map(calendar => (
          <div key={calendar.id} className={styles.row}>
            <span className={styles.swatch} data-color={calendar.color} aria-hidden="true" />
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>{calendar.name}</span>
              <span className={styles.rowMeta}>{calendar.host}</span>
            </div>
            <div className={styles.rowActions}>
              <ConfirmMorph label="Remove" prompt={`Remove ${calendar.name}?`} confirmLabel="Remove" pendingLabel="Removing" doneLabel="Removed" onConfirm={async () => {
                const result = await removeCalendar(calendar.id);
                if (!result.ok) throw new Error(result.error);
                router.refresh();
              }} />
            </div>
          </div>
        ))}
      </Glass>

      <Dialog open={adding} onOpenChange={open => { setAdding(open); if (!open) setError(null); }}>
        <DialogContent className={glassSheetClass} title="Add a calendar" description="The address is encrypted, and Hearth only ever reads from it.">
          <form className={styles.form} onSubmit={submit}>
            <ol className={styles.steps}>
              <li>Open Google Calendar on a computer, then Settings.</li>
              <li>Under Settings for my calendars, choose the calendar, then Integrate calendar.</li>
              <li>Copy Secret address in iCal format and paste it below.</li>
            </ol>
            <Input label="Name" name="name" placeholder="Family" required autoComplete="off" maxLength={60} />
            <PasswordField label="Secret iCal address" name="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" required autoComplete="off"
              description="Anyone with this address can read the calendar, so treat it like a password. Apple and Outlook links that start with webcal:// work too." />
            <fieldset className={styles.colorField}>
              <legend className={styles.colorLegend}>Colour</legend>
              <div role="radiogroup" className={styles.colors}>
                {TILE_COLORS.map(option => (
                  <button key={option} type="button" role="radio" aria-checked={color === option} aria-label={capitalize(option)} title={capitalize(option)} className={styles.colorOption} data-color={option} onClick={() => setColor(option)} />
                ))}
              </div>
            </fieldset>
            <Alert tone="danger" title="Could not add the calendar" open={Boolean(error)}>{error ?? ""}</Alert>
            <div className={styles.formActions}>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" loading={pending}>Add calendar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
