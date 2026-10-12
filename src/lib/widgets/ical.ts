import ICAL from "ical.js";

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  /** An ISO instant, or a `YYYY-MM-DD` date for all-day events. */
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
}

const MAX_STEPS = 2000;

/** Every occurrence between `from` and `to`, with recurring events expanded and their moved or cancelled instances applied. */
export function eventsBetween(text: string, calendarId: string, from: Date, to: Date): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const zone of root.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(zone);
  const groups = new Map<string, { master?: ICAL.Component; exceptions: ICAL.Component[] }>();
  for (const component of root.getAllSubcomponents("vevent")) {
    if (String(component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED" && !component.hasProperty("recurrence-id")) continue;
    const uid = String(component.getFirstPropertyValue("uid") ?? crypto.randomUUID());
    const group = groups.get(uid) ?? { exceptions: [] };
    if (component.hasProperty("recurrence-id")) group.exceptions.push(component);
    else group.master = component;
    groups.set(uid, group);
  }

  const start = ICAL.Time.fromJSDate(from, true);
  const events: CalendarEvent[] = [];
  const push = (uid: string, title: string, location: string, startDate: ICAL.Time, endDate: ICAL.Time, cancelled = false) => {
    if (cancelled) return;
    const startsAt = startDate.toJSDate();
    const endsAt = endDate.toJSDate();
    if (endsAt <= from || startsAt >= to) return;
    const allDay = startDate.isDate;
    events.push({
      id: `${calendarId}:${uid}:${startDate.toString()}`,
      calendarId,
      title: title || "Busy",
      start: allDay ? startDate.toString() : startsAt.toISOString(),
      end: allDay ? endDate.toString() : endsAt.toISOString(),
      allDay,
      location: location || null,
    });
  };

  for (const [uid, group] of groups) {
    const components = group.master ? [group.master] : group.exceptions;
    for (const component of components) {
      const event = new ICAL.Event(component, { exceptions: group.master ? group.exceptions : [] });
      if (!event.startDate) continue;
      if (!event.isRecurring()) {
        push(uid, event.summary, event.location, event.startDate, event.endDate ?? event.startDate);
        continue;
      }
      const iterator = event.iterator();
      for (let step = 0, next = iterator.next(); next && step < MAX_STEPS; step++, next = iterator.next()) {
        if (next.toJSDate() >= to) break;
        const details = event.getOccurrenceDetails(next);
        if (details.endDate.compare(start) <= 0) continue;
        const cancelled = String(details.item.component.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED";
        push(uid, details.item.summary, details.item.location, details.startDate, details.endDate, cancelled);
      }
    }
  }
  return events;
}
