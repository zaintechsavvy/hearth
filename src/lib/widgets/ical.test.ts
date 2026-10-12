import { describe, expect, it } from "vitest";
import { eventsBetween } from "./ical";

const FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:America/Toronto
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:dentist
DTSTART;TZID=America/Toronto:20261014T090000
DTEND;TZID=America/Toronto:20261014T100000
SUMMARY:Dentist
LOCATION:Queen St
END:VEVENT
BEGIN:VEVENT
UID:holiday
DTSTART;VALUE=DATE:20261012
DTEND;VALUE=DATE:20261013
SUMMARY:Thanksgiving
END:VEVENT
BEGIN:VEVENT
UID:standup
DTSTART:20261005T140000Z
DTEND:20261005T141500Z
RRULE:FREQ=DAILY;COUNT=30
SUMMARY:Standup
END:VEVENT
BEGIN:VEVENT
UID:standup
RECURRENCE-ID:20261013T140000Z
DTSTART:20261013T160000Z
DTEND:20261013T161500Z
SUMMARY:Standup, moved
END:VEVENT
BEGIN:VEVENT
UID:standup
RECURRENCE-ID:20261014T140000Z
DTSTART:20261014T140000Z
DTEND:20261014T141500Z
STATUS:CANCELLED
SUMMARY:Standup
END:VEVENT
BEGIN:VEVENT
UID:old
DTSTART:20250101T120000Z
DTEND:20250101T130000Z
SUMMARY:Long ago
END:VEVENT
END:VCALENDAR`.replaceAll("\n", "\r\n");

describe("eventsBetween", () => {
  const events = eventsBetween(FEED, "cal", new Date("2026-10-12T00:00:00Z"), new Date("2026-10-16T00:00:00Z"));
  const titled = (title: string) => events.filter(event => event.title === title);

  it("converts zoned times to instants", () => {
    expect(titled("Dentist")).toEqual([expect.objectContaining({ start: "2026-10-14T13:00:00.000Z", end: "2026-10-14T14:00:00.000Z", allDay: false, location: "Queen St" })]);
  });

  it("keeps all-day events as dates", () => {
    expect(titled("Thanksgiving")).toEqual([expect.objectContaining({ start: "2026-10-12", end: "2026-10-13", allDay: true })]);
  });

  it("expands recurrences inside the window, applying moved and cancelled instances", () => {
    expect(titled("Standup").map(event => event.start)).toEqual(["2026-10-12T14:00:00.000Z", "2026-10-15T14:00:00.000Z"]);
    expect(titled("Standup, moved").map(event => event.start)).toEqual(["2026-10-13T16:00:00.000Z"]);
  });

  it("leaves out events outside the window", () => {
    expect(titled("Long ago")).toEqual([]);
  });
});
