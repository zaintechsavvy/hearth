import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reminder } from "@/lib/db/schema";

export interface Reminder {
  id: string;
  title: string;
  dueAt: string | null;
  doneAt: string | null;
}

const DONE_SHOWN = 10;

/** Open reminders soonest first, those without a date after them, then the last few finished. */
export async function remindersFor(userId: string): Promise<Reminder[]> {
  const rows = await db.select().from(reminder).where(eq(reminder.userId, userId)).orderBy(desc(reminder.createdAt));
  const due = (row: typeof rows[number]) => row.dueAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const open = rows.filter(row => !row.doneAt).sort((a, b) => due(a) - due(b));
  const done = rows.filter(row => row.doneAt).sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0)).slice(0, DONE_SHOWN);
  return [...open, ...done].map(row => ({ id: row.id, title: row.title, dueAt: row.dueAt?.toISOString() ?? null, doneAt: row.doneAt?.toISOString() ?? null }));
}
