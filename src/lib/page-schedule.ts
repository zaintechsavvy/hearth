/** Pages this screen switches to by time of day, such as a Night page from 22:00 to 07:00. Kept on the device. */
export interface PageRule {
  id: string;
  pageId: string;
  /** HH:MM; a window may run past midnight. */
  from: string;
  to: string;
}

export const PAGE_SCHEDULE_KEY = "hearth-page-schedule";
export const NO_PAGE_RULES: PageRule[] = [];

const minutes = (time: string) => {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
};

export function inWindow(from: string, to: string, now: Date) {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutes(from), end = minutes(to);
  return start === end ? false : start < end ? current >= start && current < end : current >= start || current < end;
}

/** The first rule whose window holds `now` and whose page still exists. */
export function activeRule(rules: PageRule[], pageIds: string[], now: Date) {
  return rules.find(rule => pageIds.includes(rule.pageId) && inWindow(rule.from, rule.to, now)) ?? null;
}
