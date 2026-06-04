export { cn } from "sharedcorelib/ui";

/** Local 'YYYY-MM-DD' — the day boundary used for tasks, water, reminders, tiers. */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
